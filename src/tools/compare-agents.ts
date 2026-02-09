import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";

export function registerCompareAgents(server: McpServer) {
  server.tool(
    "compare_agents",
    "Compare performance metrics side-by-side for multiple agents. Shows P&L, win rate, trade count, budget utilization, and ranking",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Owner wallet address"),
      agentIds: z
        .array(z.string().min(1))
        .min(2)
        .max(10)
        .optional()
        .describe("Specific agent IDs to compare. If omitted, compares all agents for the wallet"),
    },
    async ({ walletAddress, agentIds }) => {
      const supabase = getSupabase();
      const wallet = walletAddress.toLowerCase();

      let query = supabase
        .from("agents")
        .select("id, config, status, stats, wallet_data, created_at")
        .eq("wallet_address", wallet);

      if (agentIds && agentIds.length > 0) {
        query = query.in("id", agentIds);
      }

      const { data: agents, error } = await query;

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching agents: ${error.message}` }],
          isError: true,
        };
      }

      if (!agents || agents.length < 2) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Need at least 2 agents to compare. Found ${agents?.length ?? 0} for this wallet.`,
            },
          ],
          isError: true,
        };
      }

      const comparison = agents.map((a: any) => {
        const stats = a.stats || {};
        const config = a.config || {};
        const wd = a.wallet_data || {};
        const allocated = wd.allocatedBudget || 0;
        const remaining = wd.remainingBudget || 0;
        const used = allocated - remaining;

        return {
          agentId: a.id,
          name: config.name || a.id.slice(0, 12),
          strategy: config.strategyId || "unknown",
          status: a.status,
          pnlUsd: stats.pnlUsd ?? stats.totalPnl ?? 0,
          pnlPct: stats.pnlPct ?? 0,
          tradeCount: stats.tradeCount ?? stats.totalTrades ?? 0,
          winRate: stats.winRate ?? 0,
          allocatedBudget: allocated,
          usedBudget: Math.round(used * 100) / 100,
          utilizationPct: allocated > 0 ? Math.round((used / allocated) * 10000) / 100 : 0,
          currency: wd.currency || config.budgetCurrency || "USDC",
          uptimeSeconds: stats.uptimeSeconds ?? 0,
          createdAt: a.created_at,
        };
      });

      // Rankings
      const byPnl = [...comparison].sort((a, b) => b.pnlUsd - a.pnlUsd);
      const byWinRate = [...comparison].sort((a, b) => b.winRate - a.winRate);
      const byTrades = [...comparison].sort((a, b) => b.tradeCount - a.tradeCount);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                wallet: walletAddress,
                agentCount: comparison.length,
                agents: comparison,
                rankings: {
                  byPnl: byPnl.map((a) => ({ agentId: a.agentId, name: a.name, pnlUsd: a.pnlUsd })),
                  byWinRate: byWinRate.map((a) => ({ agentId: a.agentId, name: a.name, winRate: a.winRate })),
                  byTradeCount: byTrades.map((a) => ({ agentId: a.agentId, name: a.name, tradeCount: a.tradeCount })),
                },
                aggregate: {
                  totalPnlUsd: Math.round(comparison.reduce((s, a) => s + a.pnlUsd, 0) * 100) / 100,
                  totalTrades: comparison.reduce((s, a) => s + a.tradeCount, 0),
                  avgWinRate:
                    comparison.length > 0
                      ? Math.round(
                          (comparison.reduce((s, a) => s + a.winRate, 0) / comparison.length) * 100
                        ) / 100
                      : 0,
                  totalAllocated: Math.round(comparison.reduce((s, a) => s + a.allocatedBudget, 0) * 100) / 100,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
