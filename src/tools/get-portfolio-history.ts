/**
 * Tool: get_portfolio_history
 * Track portfolio value snapshots over time.
 * Combines current on-chain state with agent P&L history.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";

export function registerGetPortfolioHistory(server: McpServer) {
  server.tool(
    "get_portfolio_history",
    "Track portfolio value over time — shows snapshots, growth trends, benchmark comparisons, and identifies best/worst periods. Uses agent P&L history to reconstruct portfolio trajectory",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Wallet address"),
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .default(30)
        .describe("Lookback period in days (default: 30)"),
    },
    async ({ walletAddress, days }) => {
      const supabase = getSupabase();

      // Fetch all agents for the wallet
      const { data: agents, error } = await supabase
        .from("agents")
        .select("id, name, status, config, stats, pnl_history, created_at")
        .eq("wallet_address", walletAddress);

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Portfolio history error: ${error.message}` }],
          isError: true,
        };
      }

      if (!agents || agents.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                walletAddress,
                period: `${days}d`,
                message: "No agents found for this wallet. Deploy agents to start tracking portfolio history.",
                snapshots: [],
              }),
            },
          ],
        };
      }

      // Reconstruct daily P&L snapshots from agent history
      const now = Date.now();
      const startTime = now - days * 86400000;

      // Aggregate all P&L entries by date
      const dailyPnl: Record<string, number> = {};
      let totalBudget = 0;

      for (const agent of agents) {
        const config = agent.config || {};
        const budget = config.budgetAmount ?? config.budget ?? 0;
        totalBudget += budget;

        const history = Array.isArray(agent.pnl_history) ? agent.pnl_history : [];
        for (const entry of history) {
          let date: string;
          let pnl: number;

          if (typeof entry === "number") {
            // Just a P&L number, distribute evenly across the period
            continue;
          } else if (entry && typeof entry === "object") {
            date = entry.date || entry.timestamp || entry.created_at || "";
            pnl = entry.pnl ?? entry.value ?? entry.amount ?? 0;
          } else {
            continue;
          }

          // Parse date to YYYY-MM-DD
          const dateKey = date.slice(0, 10);
          if (dateKey && new Date(dateKey).getTime() >= startTime) {
            dailyPnl[dateKey] = (dailyPnl[dateKey] || 0) + pnl;
          }
        }
      }

      // Build equity curve
      const sortedDates = Object.keys(dailyPnl).sort();
      let cumulativePnl = 0;
      const initialValue = totalBudget;
      const snapshots: { date: string; portfolioValue: number; dailyPnl: number; cumulativePnl: number }[] = [];

      for (const date of sortedDates) {
        const dayPnl = dailyPnl[date];
        cumulativePnl += dayPnl;
        snapshots.push({
          date,
          portfolioValue: Math.round((initialValue + cumulativePnl) * 100) / 100,
          dailyPnl: Math.round(dayPnl * 100) / 100,
          cumulativePnl: Math.round(cumulativePnl * 100) / 100,
        });
      }

      // Stats
      const currentValue = initialValue + cumulativePnl;
      const totalReturnPct = initialValue > 0 ? ((currentValue - initialValue) / initialValue) * 100 : 0;

      const dailyReturns = snapshots.map((s) => s.dailyPnl);
      const bestDay = snapshots.reduce(
        (best, s) => (s.dailyPnl > (best?.dailyPnl ?? -Infinity) ? s : best),
        snapshots[0]
      );
      const worstDay = snapshots.reduce(
        (worst, s) => (s.dailyPnl < (worst?.dailyPnl ?? Infinity) ? s : worst),
        snapshots[0]
      );

      // Max drawdown from equity curve
      let peak = initialValue;
      let maxDD = 0;
      for (const s of snapshots) {
        if (s.portfolioValue > peak) peak = s.portfolioValue;
        const dd = ((peak - s.portfolioValue) / peak) * 100;
        if (dd > maxDD) maxDD = dd;
      }

      // Winning / losing days
      const winningDays = dailyReturns.filter((r) => r > 0).length;
      const losingDays = dailyReturns.filter((r) => r < 0).length;
      const flatDays = dailyReturns.filter((r) => r === 0).length;

      // Streaks
      let currentStreak = 0;
      let longestWinStreak = 0;
      let longestLoseStreak = 0;
      let streakType: "win" | "lose" | null = null;

      for (const r of dailyReturns) {
        if (r > 0) {
          if (streakType === "win") {
            currentStreak++;
          } else {
            if (streakType === "lose" && currentStreak > longestLoseStreak) longestLoseStreak = currentStreak;
            currentStreak = 1;
            streakType = "win";
          }
          if (currentStreak > longestWinStreak) longestWinStreak = currentStreak;
        } else if (r < 0) {
          if (streakType === "lose") {
            currentStreak++;
          } else {
            if (streakType === "win" && currentStreak > longestWinStreak) longestWinStreak = currentStreak;
            currentStreak = 1;
            streakType = "lose";
          }
          if (currentStreak > longestLoseStreak) longestLoseStreak = currentStreak;
        }
      }

      // Limit snapshot output
      const outputSnapshots = snapshots.length <= 31
        ? snapshots
        : [...snapshots.slice(0, 5), { date: "...", portfolioValue: 0, dailyPnl: 0, cumulativePnl: 0 }, ...snapshots.slice(-10)];

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                walletAddress,
                period: `${days}d`,
                totalAgents: agents.length,
                activeAgents: agents.filter((a: any) => a.status === "active").length,
                summary: {
                  initialValue: Math.round(initialValue * 100) / 100,
                  currentValue: Math.round(currentValue * 100) / 100,
                  totalPnl: Math.round(cumulativePnl * 100) / 100,
                  totalReturnPct: `${Math.round(totalReturnPct * 100) / 100}%`,
                  maxDrawdownPct: `${Math.round(maxDD * 100) / 100}%`,
                },
                dayStats: {
                  totalDays: snapshots.length,
                  winningDays,
                  losingDays,
                  flatDays,
                  winRate: snapshots.length > 0
                    ? `${Math.round((winningDays / snapshots.length) * 10000) / 100}%`
                    : "N/A",
                  longestWinStreak,
                  longestLoseStreak,
                },
                bestDay: bestDay
                  ? { date: bestDay.date, pnl: bestDay.dailyPnl }
                  : null,
                worstDay: worstDay
                  ? { date: worstDay.date, pnl: worstDay.dailyPnl }
                  : null,
                snapshots: outputSnapshots,
                generatedAt: new Date().toISOString(),
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
