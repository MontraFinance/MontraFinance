/**
 * Tool: get_trade_journal
 * Generate a formatted trade journal from agent P&L history.
 * Provides insights into trading patterns, streaks, and performance over time.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";

export function registerGetTradeJournal(server: McpServer) {
  server.tool(
    "get_trade_journal",
    "Generate a formatted trade journal from agent history — patterns, streaks, best/worst days, and performance insights",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Wallet address"),
      agentId: z.string().optional().describe("Specific agent ID (default: all agents)"),
    },
    async ({ walletAddress, agentId }) => {
      try {
        const supabase = getSupabase();

        let query = supabase
          .from("agents")
          .select("id, config, stats, pnl_history, status, created_at")
          .eq("wallet_address", walletAddress.toLowerCase());

        if (agentId) {
          query = query.eq("id", agentId);
        }

        const { data: agents, error } = await query;
        if (error) throw error;
        if (!agents || agents.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: "No agents found for this wallet" }, null, 2),
            }],
          };
        }

        const journal: any[] = [];
        let totalPnl = 0;
        let totalTrades = 0;
        let bestDay = { pnl: -Infinity, date: "", agent: "" };
        let worstDay = { pnl: Infinity, date: "", agent: "" };
        let longestWinStreak = 0;
        let longestLoseStreak = 0;

        for (const agent of agents) {
          const config = agent.config as Record<string, any>;
          const stats = agent.stats as Record<string, any>;
          const history = (agent.pnl_history || []) as any[];

          const agentPnl = stats?.totalPnl || stats?.pnl || 0;
          const agentTrades = stats?.totalTrades || stats?.trades || 0;
          totalPnl += agentPnl;
          totalTrades += agentTrades;

          // Analyze P&L history for streaks and patterns
          let currentWinStreak = 0;
          let currentLoseStreak = 0;

          const entries = history.map((point: any, idx: number) => {
            const pnl = point.pnl || point.value || 0;
            const date = point.timestamp || point.date || `Period ${idx + 1}`;

            if (pnl > 0) {
              currentWinStreak++;
              currentLoseStreak = 0;
              if (currentWinStreak > longestWinStreak) longestWinStreak = currentWinStreak;
            } else if (pnl < 0) {
              currentLoseStreak++;
              currentWinStreak = 0;
              if (currentLoseStreak > longestLoseStreak) longestLoseStreak = currentLoseStreak;
            }

            if (pnl > bestDay.pnl) {
              bestDay = { pnl, date, agent: agent.id };
            }
            if (pnl < worstDay.pnl) {
              worstDay = { pnl, date, agent: agent.id };
            }

            return { date, pnl: Math.round(pnl * 100) / 100 };
          });

          journal.push({
            agentId: agent.id,
            strategy: config.strategy || config.name || "unknown",
            status: agent.status,
            deployedAt: agent.created_at,
            totalPnl: Math.round(agentPnl * 100) / 100,
            totalTrades: agentTrades,
            winRate: stats?.winRate || null,
            recentHistory: entries.slice(-10),
          });
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              walletAddress: walletAddress.toLowerCase(),
              summary: {
                totalAgents: agents.length,
                activeAgents: agents.filter((a: any) => a.status === "active").length,
                totalPnl: Math.round(totalPnl * 100) / 100,
                totalTrades,
                bestDay: bestDay.pnl > -Infinity ? bestDay : null,
                worstDay: worstDay.pnl < Infinity ? worstDay : null,
                longestWinStreak,
                longestLoseStreak,
              },
              agents: journal,
              insight: totalPnl > 0
                ? `Portfolio is profitable ($${Math.round(totalPnl * 100) / 100}). ${longestWinStreak >= 5 ? "Strong momentum detected." : ""}`
                : `Portfolio is underwater ($${Math.round(totalPnl * 100) / 100}). Consider reviewing underperforming agents.`,
            }, null, 2),
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: err.message }, null, 2),
          }],
        };
      }
    }
  );
}
