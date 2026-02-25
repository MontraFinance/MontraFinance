/**
 * Audit trail utilities — logs all significant actions for compliance.
 * Stores in Supabase `audit_logs` table.
 */
import { getSupabase } from "./supabase.js";

export type AuditAction =
  | "agent_deploy" | "agent_pause" | "agent_stop" | "agent_delete"
  | "trade_execute" | "trade_cancel"
  | "portfolio_rebalance"
  | "burn_submit" | "burn_complete"
  | "api_key_create" | "api_key_revoke"
  | "smart_account_create" | "smart_account_update"
  | "alert_create" | "alert_delete"
  | "api_call" | "login" | "settings_change";

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditEntry {
  wallet_address: string;
  action: AuditAction;
  severity: AuditSeverity;
  description: string;
  metadata?: Record<string, unknown>;
  ip_address?: string | null;
  tx_hash?: string | null;
}

/** Write an audit log entry */
export async function logAudit(entry: AuditEntry): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("audit_logs").insert({
    wallet_address: entry.wallet_address.toLowerCase(),
    action: entry.action,
    severity: entry.severity,
    description: entry.description,
    metadata: entry.metadata || {},
    ip_address: entry.ip_address || null,
    tx_hash: entry.tx_hash || null,
  });
}

/** Query audit logs with filters */
export async function queryAuditLogs(filters: {
  walletAddress?: string;
  action?: AuditAction;
  severity?: AuditSeverity;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = getSupabase();
  let query = supabase.from("audit_logs").select("*", { count: "exact" });

  if (filters.walletAddress) query = query.eq("wallet_address", filters.walletAddress.toLowerCase());
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.startDate) query = query.gte("created_at", filters.startDate);
  if (filters.endDate) query = query.lte("created_at", filters.endDate);

  query = query.order("created_at", { ascending: false });

  if (filters.limit) query = query.limit(filters.limit);
  if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`Audit query failed: ${error.message}`);

  return { logs: data || [], total: count || 0 };
}

/** Get usage metrics for a wallet */
export async function getUsageMetrics(walletAddress: string) {
  const supabase = getSupabase();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Total API calls
  const { count: totalCalls } = await supabase
    .from("api_usage")
    .select("*", { count: "exact", head: true })
    .eq("wallet_address", walletAddress.toLowerCase());

  // Today's calls
  const { count: callsToday } = await supabase
    .from("api_usage")
    .select("*", { count: "exact", head: true })
    .eq("wallet_address", walletAddress.toLowerCase())
    .gte("created_at", todayStart);

  // This month's calls
  const { count: callsThisMonth } = await supabase
    .from("api_usage")
    .select("*", { count: "exact", head: true })
    .eq("wallet_address", walletAddress.toLowerCase())
    .gte("created_at", monthStart);

  // Top tools (last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
  const { data: usageData } = await supabase
    .from("api_usage")
    .select("tool")
    .eq("wallet_address", walletAddress.toLowerCase())
    .gte("created_at", thirtyDaysAgo);

  const toolCounts: Record<string, number> = {};
  for (const row of usageData || []) {
    toolCounts[row.tool] = (toolCounts[row.tool] || 0) + 1;
  }
  const topTools = Object.entries(toolCounts)
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalCalls: totalCalls || 0,
    callsToday: callsToday || 0,
    callsThisMonth: callsThisMonth || 0,
    topTools,
  };
}

/** Log an API usage record */
export async function logApiUsage(walletAddress: string, apiKeyId: string, tool: string, statusCode: number, latencyMs: number) {
  const supabase = getSupabase();
  await supabase.from("api_usage").insert({
    wallet_address: walletAddress.toLowerCase(),
    api_key_id: apiKeyId,
    tool,
    status_code: statusCode,
    latency_ms: latencyMs,
  });
}
