/**
 * Public REST API wrapping MCP tools — /api/v1/{tool_name}
 * Authenticated via API key in Authorization: Bearer mn_live_xxx header.
 * Tier-based rate limiting and usage tracking.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCorsHeaders } from "../_lib/cors.js";
import { validateApiKey } from "../_lib/api-keys.js";
import { logApiUsage, logAudit } from "../_lib/audit.js";
import { checkRateLimit } from "../_lib/rate-limit.js";
import { getSupabase } from "../_lib/supabase.js";

/** Extract Bearer token from Authorization header */
function extractKey(req: VercelRequest): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

/** Map of tool names to their MCP handler functions (simplified REST wrappers) */
const TOOL_REGISTRY: Record<string, (params: Record<string, unknown>) => Promise<Record<string, unknown>>> = {};

/**
 * Generic tool executor — looks up tool data from Supabase or external APIs.
 * This is a REST proxy; the actual MCP tools run via stdio transport.
 * For the REST API, we provide simplified data access wrappers.
 */
async function executeTool(toolName: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const supabase = getSupabase();

  // Route to specific data handlers
  switch (toolName) {
    case "list_strategies": {
      const { data } = await supabase.from("strategies").select("*");
      return { strategies: data || [] };
    }
    case "list_agents": {
      const wallet = params.wallet_address as string;
      const query = wallet
        ? supabase.from("agents").select("*").eq("wallet_address", wallet.toLowerCase())
        : supabase.from("agents").select("*");
      const { data } = await query;
      return { agents: data || [] };
    }
    case "get_portfolio": {
      const wallet = params.wallet_address as string;
      if (!wallet) return { error: "wallet_address required" };
      const { data } = await supabase.from("agents").select("*").eq("wallet_address", wallet.toLowerCase());
      const agents = data || [];
      const totalPnl = agents.reduce((sum: number, a: any) => sum + (a.stats?.pnlUsd || 0), 0);
      return { wallet, agentCount: agents.length, totalPnlUsd: totalPnl, agents };
    }
    case "get_agent_performance": {
      const agentId = params.agent_id as string;
      if (!agentId) return { error: "agent_id required" };
      const { data } = await supabase.from("agents").select("*").eq("id", agentId).single();
      return data ? { agent: data } : { error: "Agent not found" };
    }
    case "get_burn_analytics": {
      const { data } = await supabase.from("burn_transactions").select("*").order("created_at", { ascending: false }).limit(100);
      const records = data || [];
      const totalBurned = records.reduce((sum: number, r: any) => sum + (r.amount_burned || 0), 0);
      return { totalBurns: records.length, totalBurned, recentBurns: records.slice(0, 10) };
    }
    default:
      return { error: `Tool '${toolName}' is not available via REST API. Use the MCP server for full tool access.`, availableTools: ["list_strategies", "list_agents", "get_portfolio", "get_agent_performance", "get_burn_analytics"] };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin);
  if (req.method === "OPTIONS") return res.status(204).end();

  const tool = req.query.tool as string;
  if (!tool) return res.status(400).json({ error: "Tool name required" });

  // Authenticate via API key
  const rawKey = extractKey(req);
  if (!rawKey) return res.status(401).json({ error: "Missing Authorization: Bearer <api_key>" });

  const startTime = Date.now();
  const keyRecord = await validateApiKey(rawKey);
  if (!keyRecord) return res.status(401).json({ error: "Invalid or revoked API key" });

  // Tier-based rate limiting (per API key ID)
  const { allowed, remaining } = checkRateLimit(`apikey:${keyRecord.id}`, keyRecord.rate_limit_per_min, 60_000);
  res.setHeader("X-RateLimit-Limit", keyRecord.rate_limit_per_min);
  res.setHeader("X-RateLimit-Remaining", remaining);

  if (!allowed) {
    const latency = Date.now() - startTime;
    await logApiUsage(keyRecord.wallet_address, keyRecord.id, tool, 429, latency);
    return res.status(429).json({ error: "Rate limit exceeded", tier: keyRecord.tier, limit: keyRecord.rate_limit_per_min });
  }

  try {
    // Execute the tool
    const params = req.method === "GET" ? (req.query as Record<string, unknown>) : (req.body || {});
    delete params.tool; // remove the route param

    const result = await executeTool(tool, params);
    const latency = Date.now() - startTime;

    // Log usage
    await logApiUsage(keyRecord.wallet_address, keyRecord.id, tool, 200, latency);

    return res.status(200).json({
      tool,
      tier: keyRecord.tier,
      latencyMs: latency,
      data: result,
    });
  } catch (err: any) {
    const latency = Date.now() - startTime;
    await logApiUsage(keyRecord.wallet_address, keyRecord.id, tool, 500, latency);
    return res.status(500).json({ error: err.message });
  }
}
