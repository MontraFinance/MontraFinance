/**
 * Compliance & Audit Trail — /api/compliance/{logs|report|export|usage}
 * Authenticated via X-Wallet-Address header.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCorsHeaders } from "../_lib/cors.js";
import { checkRateLimit } from "../_lib/rate-limit.js";
import { queryAuditLogs, getUsageMetrics } from "../_lib/audit.js";
import { getSupabase } from "../_lib/supabase.js";

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

function getWallet(req: VercelRequest): string | null {
  const wallet = req.headers["x-wallet-address"] as string;
  return wallet && WALLET_RE.test(wallet) ? wallet : null;
}

/** GET /api/compliance/logs — Query audit logs */
async function handleLogs(req: VercelRequest, res: VercelResponse) {
  const wallet = getWallet(req);
  if (!wallet) return res.status(401).json({ error: "Missing X-Wallet-Address" });

  const { action, severity, startDate, endDate, limit, offset } = req.query;

  const result = await queryAuditLogs({
    walletAddress: wallet,
    action: action as any,
    severity: severity as any,
    startDate: startDate as string,
    endDate: endDate as string,
    limit: limit ? parseInt(limit as string, 10) : 50,
    offset: offset ? parseInt(offset as string, 10) : 0,
  });

  return res.status(200).json(result);
}

/** GET /api/compliance/usage — API usage metrics */
async function handleUsage(req: VercelRequest, res: VercelResponse) {
  const wallet = getWallet(req);
  if (!wallet) return res.status(401).json({ error: "Missing X-Wallet-Address" });

  const metrics = await getUsageMetrics(wallet);
  return res.status(200).json(metrics);
}

/** POST /api/compliance/report — Generate a compliance report */
async function handleReport(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const wallet = getWallet(req);
  if (!wallet) return res.status(401).json({ error: "Missing X-Wallet-Address" });

  const { reportType, periodStart, periodEnd } = req.body || {};
  if (!reportType || !periodStart || !periodEnd) {
    return res.status(400).json({ error: "reportType, periodStart, periodEnd required" });
  }

  const supabase = getSupabase();

  // Fetch transactions in period
  const { data: burns } = await supabase
    .from("burn_transactions")
    .select("*")
    .eq("wallet_address", wallet.toLowerCase())
    .gte("created_at", periodStart)
    .lte("created_at", periodEnd);

  const { data: agents } = await supabase
    .from("agents")
    .select("*")
    .eq("wallet_address", wallet.toLowerCase());

  const totalBurned = (burns || []).reduce((sum: number, b: any) => sum + (b.amount_burned || 0), 0);
  const totalPnl = (agents || []).reduce((sum: number, a: any) => sum + (a.stats?.pnlUsd || 0), 0);

  const { logs } = await queryAuditLogs({
    walletAddress: wallet,
    startDate: periodStart,
    endDate: periodEnd,
    limit: 1000,
  });

  // Store the report
  const report = {
    wallet_address: wallet.toLowerCase(),
    report_type: reportType,
    period_start: periodStart,
    period_end: periodEnd,
    total_transactions: (burns || []).length + logs.length,
    total_volume: totalBurned,
    pnl: totalPnl,
    status: "ready",
    report_data: {
      burns: burns || [],
      agents: agents || [],
      auditLogs: logs,
      summary: {
        totalBurns: (burns || []).length,
        totalBurned,
        totalAgents: (agents || []).length,
        totalPnl,
        auditEvents: logs.length,
      },
    },
  };

  const { data, error } = await supabase.from("compliance_reports").insert(report).select().single();
  if (error) return res.status(500).json({ error: error.message });

  return res.status(201).json(data);
}

/** GET /api/compliance/export — Export audit logs as CSV */
async function handleExport(req: VercelRequest, res: VercelResponse) {
  const wallet = getWallet(req);
  if (!wallet) return res.status(401).json({ error: "Missing X-Wallet-Address" });

  const { startDate, endDate } = req.query;

  const { logs } = await queryAuditLogs({
    walletAddress: wallet,
    startDate: startDate as string,
    endDate: endDate as string,
    limit: 10000,
  });

  // Build CSV
  const headers = "id,timestamp,action,severity,description,tx_hash,ip_address\n";
  const rows = logs.map((l: any) =>
    `${l.id},${l.created_at},${l.action},${l.severity},"${(l.description || "").replace(/"/g, '""')}",${l.tx_hash || ""},${l.ip_address || ""}`
  ).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="montra-audit-${wallet.slice(0, 8)}.csv"`);
  return res.status(200).send(headers + rows);
}

const handlers: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<any>> = {
  logs: handleLogs,
  usage: handleUsage,
  report: handleReport,
  export: handleExport,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin);
  if (req.method === "OPTIONS") return res.status(204).end();

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || "unknown";
  const { allowed } = checkRateLimit(ip, 30);
  if (!allowed) return res.status(429).json({ error: "Rate limited" });

  const action = req.query.action as string;
  const fn = handlers[action];
  if (!fn) return res.status(404).json({ error: `Unknown action: ${action}` });

  try {
    return await fn(req, res);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
