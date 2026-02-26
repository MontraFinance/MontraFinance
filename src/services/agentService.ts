/**
 * Agent service — API calls for agent CRUD against Supabase via Vercel functions.
 * Pattern: mirrors src/services/burnService.ts
 */
import type { Agent, AgentStats, PnlDataPoint } from "@/types/agent";
import { fetchWithTimeout } from "@/lib/fetch";

const API_BASE = "/api/agents";

// ─── Row → Agent mapper ─────────────────────────────────────────────

interface AgentRow {
  id: string;
  wallet_address: string;
  config: Agent["config"];
  wallet_data: Agent["wallet"];
  stats: Agent["stats"];
  status: Agent["status"];
  pnl_history: Agent["pnlHistory"];
  created_at: string;
  updated_at: string;
  erc8004_agent_id: number | null;
  erc8004_tx_hash: string | null;
  erc8004_registered_at: string | null;
}

export function mapRowToAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    config: row.config,
    wallet: row.wallet_data,
    stats: row.stats,
    status: row.status,
    pnlHistory: row.pnl_history,
    createdAt: row.created_at,
    deployedByAddress: row.wallet_address,
    erc8004AgentId: row.erc8004_agent_id ?? null,
    erc8004TxHash: row.erc8004_tx_hash ?? null,
    erc8004RegisteredAt: row.erc8004_registered_at ?? null,
  };
}

// ─── API Calls ───────────────────────────────────────────────────────

export async function deployAgentAPI(
  walletAddress: string,
  agent: Agent
): Promise<AgentRow> {
  const resp = await fetchWithTimeout(`${API_BASE}/deploy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress,
      id: agent.id,
      config: agent.config,
      wallet: agent.wallet,
      stats: agent.stats,
      pnlHistory: agent.pnlHistory,
    }),
  }, 15_000);
  if (!resp.ok) throw new Error(`Deploy failed: ${resp.status}`);
  const json = await resp.json();
  return json.agent;
}

export async function listAgentsAPI(walletAddress: string): Promise<Agent[]> {
  try {
    const resp = await fetchWithTimeout(
      `${API_BASE}/list?wallet=${encodeURIComponent(walletAddress)}`
    );
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.agents || []).map(mapRowToAgent);
  } catch (err) {
    console.warn('[agentService] listAgents failed:', err);
    return [];
  }
}

export async function updateStatusAPI(
  walletAddress: string,
  agentId: string,
  status: string
): Promise<void> {
  await fetchWithTimeout(`${API_BASE}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, agentId, status }),
  });
}

export async function fundAgentAPI(
  walletAddress: string,
  agentId: string,
  amount: number
): Promise<void> {
  await fetchWithTimeout(`${API_BASE}/fund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, agentId, amount }),
  });
}

export async function deleteAgentAPI(
  walletAddress: string,
  agentId: string
): Promise<void> {
  await fetchWithTimeout(`${API_BASE}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, agentId }),
  });
}

export async function updateStatsAPI(
  walletAddress: string,
  agentId: string,
  stats: Partial<AgentStats>,
  pnlPoint?: PnlDataPoint
): Promise<void> {
  await fetchWithTimeout(`${API_BASE}/stats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, agentId, stats, pnlPoint }),
  });
}

export async function registerAgentAPI(
  walletAddress: string,
  agentId: string,
  erc8004AgentId: number,
  txHash: string
): Promise<void> {
  const resp = await fetchWithTimeout(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, agentId, erc8004AgentId, txHash }),
  });
  if (!resp.ok) throw new Error(`Register failed: ${resp.status}`);
}
