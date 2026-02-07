import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";

export function registerGetAgentPerformance(server: McpServer) {
  server.tool(
    "get_agent_performance",
    "Get detailed performance metrics for a specific agent including P&L history, win rate, trade count, and drawdown stats",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Owner wallet address for authorization"),
      agentId: z.string().min(1).describe("The agent ID to get performance data for"),
    },
    async ({ walletAddress, agentId }) => {
      const supabase = getSupabase();

      const { data: agent, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", agentId)
        .eq("wallet_address", walletAddress.toLowerCase())
        .single();

      if (error || !agent) {
        return {
          content: [
            {
              type: "text" as const,
              text: error
                ? `Error fetching agent: ${error.message}`
                : `Agent ${agentId} not found or not owned by ${walletAddress}`,
            },
          ],
          isError: true,
        };
      }

      const stats = agent.stats || {};
      const config = agent.config || {};
      const walletData = agent.wallet_data || {};
      const pnlHistory: Array<{ timestamp: string; pnlUsd: number }> = agent.pnl_history || [];

      // Compute additional derived metrics
      const budgetUsed =
        walletData.allocatedBudget && walletData.remainingBudget
          ? walletData.allocatedBudget - walletData.remainingBudget
          : 0;
      const budgetUtilization =
        walletData.allocatedBudget > 0
          ? Math.round((budgetUsed / walletData.allocatedBudget) * 10000) / 100
          : 0;

      // Compute uptime in human-readable form
      const uptimeSeconds = stats.uptimeSeconds || 0;
      const uptimeHours = Math.floor(uptimeSeconds / 3600);
      const uptimeDays = Math.floor(uptimeHours / 24);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                agentId: agent.id,
                name: config.name || agent.id,
                strategy: config.strategyId || "unknown",
                status: agent.status,
                createdAt: agent.created_at,
                performance: {
                  pnlUsd: stats.pnlUsd ?? stats.totalPnl ?? 0,
                  pnlPct: stats.pnlPct ?? 0,
                  tradeCount: stats.tradeCount ?? stats.totalTrades ?? 0,
                  winRate: stats.winRate ?? 0,
                  uptimeSeconds,
                  uptimeFormatted: uptimeDays > 0 ? `${uptimeDays}d ${uptimeHours % 24}h` : `${uptimeHours}h`,
                  lastTradeAt: stats.lastTradeAt || null,
                },
                budget: {
                  currency: walletData.currency || config.budgetCurrency || "USDC",
                  allocated: walletData.allocatedBudget || 0,
                  remaining: walletData.remainingBudget || 0,
                  used: budgetUsed,
                  utilizationPct: budgetUtilization,
                },
                riskConfig: {
                  maxDrawdownPct: config.maxDrawdownPct || null,
                  maxPositionSizePct: config.maxPositionSizePct || null,
                  mandate: config.mandate || null,
                },
                pnlHistory: pnlHistory.slice(-48),
                pnlHistoryCount: pnlHistory.length,
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
