/**
 * Tool: get_agent_leaderboard
 * Global agent leaderboard ranked by P&L, win rate, or Sharpe ratio.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";

export function registerGetAgentLeaderboard(server: McpServer) {
  server.tool(
    "get_agent_leaderboard",
    "Global agent leaderboard — ranks all trading agents across the platform by P&L, win rate, or trade count. See who's winning on Montra",
    {
      rankBy: z
        .enum(["pnl", "win_rate", "trades", "sharpe"])
        .optional()
        .default("pnl")
        .describe("Ranking metric (default: pnl)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Top N agents to return (default: 10)"),
      strategyFilter: z
        .enum(["momentum", "mean_reversion", "arbitrage", "breakout", "grid_trading", "dca"])
        .optional()
        .describe("Filter by strategy type"),
      statusFilter: z
        .enum(["active", "paused", "stopped", "all"])
        .optional()
        .default("active")
        .describe("Filter by agent status (default: active)"),
    },
    async ({ rankBy, limit, strategyFilter, statusFilter }) => {
      const supabase = getSupabase();

      let query = supabase
        .from("agents")
        .select("id, name, wallet_address, status, config, stats, pnl_history, created_at");

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: agents, error } = await query;

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Leaderboard error: ${error.message}` }],
          isError: true,
        };
      }

      if (!agents || agents.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                leaderboard: [],
                totalAgents: 0,
                message: "No agents found matching criteria",
              }),
            },
          ],
        };
      }

      // Derive metrics for each agent
      const scored = agents
        .filter((a: any) => {
          if (!strategyFilter) return true;
          const strat = a.config?.strategy || a.config?.strategyId;
          return strat === strategyFilter;
        })
        .map((a: any) => {
          const stats = a.stats || {};
          const config = a.config || {};
          const pnlHistory: number[] = Array.isArray(a.pnl_history)
            ? a.pnl_history.map((p: any) => (typeof p === "number" ? p : p?.pnl ?? 0))
            : [];

          const totalPnl = stats.total_pnl ?? stats.totalPnl ?? pnlHistory.reduce((s: number, v: number) => s + v, 0);
          const totalTrades = stats.total_trades ?? stats.totalTrades ?? pnlHistory.length;
          const winTrades = stats.wins ?? Math.round(totalTrades * ((stats.win_rate ?? stats.winRate ?? 50) / 100));
          const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;

          // Simplified Sharpe proxy
          const avgReturn = totalTrades > 0 ? totalPnl / totalTrades : 0;
          const variance =
            pnlHistory.length > 1
              ? pnlHistory.reduce((s: number, v: number) => s + Math.pow(v - avgReturn, 2), 0) / pnlHistory.length
              : 1;
          const sharpe = Math.sqrt(variance) > 0 ? avgReturn / Math.sqrt(variance) : 0;

          return {
            agentId: a.id,
            name: a.name || `Agent ${a.id.slice(0, 6)}`,
            walletAddress: a.wallet_address ? `${a.wallet_address.slice(0, 6)}...${a.wallet_address.slice(-4)}` : null,
            status: a.status,
            strategy: config.strategy || config.strategyId || "unknown",
            totalPnl: Math.round(totalPnl * 100) / 100,
            winRate: Math.round(winRate * 100) / 100,
            totalTrades,
            sharpe: Math.round(sharpe * 100) / 100,
            budget: config.budgetAmount ?? config.budget ?? null,
            createdAt: a.created_at,
          };
        });

      // Sort by selected metric
      scored.sort((a, b) => {
        switch (rankBy) {
          case "pnl": return b.totalPnl - a.totalPnl;
          case "win_rate": return b.winRate - a.winRate;
          case "trades": return b.totalTrades - a.totalTrades;
          case "sharpe": return b.sharpe - a.sharpe;
          default: return b.totalPnl - a.totalPnl;
        }
      });

      const leaderboard = scored.slice(0, limit).map((a, i) => ({
        rank: i + 1,
        ...a,
      }));

      // Platform stats
      const totalPnl = scored.reduce((s, a) => s + a.totalPnl, 0);
      const avgWinRate = scored.length > 0
        ? scored.reduce((s, a) => s + a.winRate, 0) / scored.length
        : 0;
      const profitable = scored.filter((a) => a.totalPnl > 0).length;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                rankedBy: rankBy,
                statusFilter: statusFilter || "active",
                strategyFilter: strategyFilter || "all",
                platformStats: {
                  totalAgents: scored.length,
                  profitableAgents: profitable,
                  unprofitableAgents: scored.length - profitable,
                  aggregatePnl: Math.round(totalPnl * 100) / 100,
                  averageWinRate: `${Math.round(avgWinRate * 100) / 100}%`,
                },
                leaderboard,
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
