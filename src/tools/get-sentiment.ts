/**
 * Tool: get_sentiment
 * Aggregate sentiment analysis from Farcaster activity and on-chain data.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";

export function registerGetSentiment(server: McpServer) {
  server.tool(
    "get_sentiment",
    "Aggregate sentiment analysis for a token or the Montra platform — combines Farcaster social activity, on-chain burn trends, and agent trading patterns into a sentiment score",
    {
      token: z
        .string()
        .optional()
        .describe("Token symbol to analyze sentiment for (default: MONTRA)"),
      days: z
        .number()
        .int()
        .min(1)
        .max(90)
        .optional()
        .default(7)
        .describe("Lookback period in days (default: 7)"),
    },
    async ({ token, days }) => {
      const symbol = (token || "MONTRA").toUpperCase();
      const supabase = getSupabase();
      const since = new Date(Date.now() - days * 86400000).toISOString();

      // 1. Farcaster social signals
      const { data: casts } = await supabase
        .from("farcaster_casts")
        .select("status, cast_text, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      const totalCasts = casts?.length ?? 0;
      const postedCasts = casts?.filter((c: any) => c.status === "posted") ?? [];
      const mentionCasts = postedCasts.filter(
        (c: any) => c.cast_text?.toUpperCase().includes(symbol)
      );

      // Analyze cast sentiment (keyword-based)
      let bullishSignals = 0;
      let bearishSignals = 0;
      const bullWords = ["pump", "moon", "bullish", "buy", "up", "gains", "profit", "ath", "breakout", "surge"];
      const bearWords = ["dump", "crash", "bearish", "sell", "down", "loss", "rug", "dip", "decline", "drop"];

      for (const c of postedCasts) {
        const text = (c.cast_text || "").toLowerCase();
        for (const w of bullWords) {
          if (text.includes(w)) { bullishSignals++; break; }
        }
        for (const w of bearWords) {
          if (text.includes(w)) { bearishSignals++; break; }
        }
      }

      // 2. On-chain burn activity (demand signal)
      const { data: burns } = await supabase
        .from("burn_transactions")
        .select("token_amount, status, created_at")
        .gte("created_at", since);

      const totalBurns = burns?.length ?? 0;
      const confirmedBurns = burns?.filter((b: any) => b.status === "confirmed") ?? [];
      const totalBurnedTokens = confirmedBurns.reduce(
        (sum: number, b: any) => sum + (parseFloat(b.token_amount) || 0),
        0
      );

      // Burn velocity (burns per day)
      const burnVelocity = totalBurns / Math.max(days, 1);

      // 3. Agent trading activity
      const { data: agents } = await supabase
        .from("agents")
        .select("status, stats, pnl_history");

      const activeAgents = agents?.filter((a: any) => a.status === "active") ?? [];
      const totalAgents = agents?.length ?? 0;

      let aggregatePnl = 0;
      let winningAgents = 0;
      let losingAgents = 0;

      for (const a of activeAgents) {
        const stats = a.stats || {};
        const pnl = stats.total_pnl || stats.totalPnl || 0;
        aggregatePnl += pnl;
        if (pnl > 0) winningAgents++;
        else if (pnl < 0) losingAgents++;
      }

      // 4. Compute composite sentiment
      const socialScore = totalCasts > 0
        ? Math.round(((bullishSignals - bearishSignals) / totalCasts + 1) * 50)
        : 50;

      const burnScore = burnVelocity > 10 ? 80 : burnVelocity > 5 ? 65 : burnVelocity > 1 ? 50 : 30;

      const agentScore = activeAgents.length > 0
        ? Math.round((winningAgents / activeAgents.length) * 100)
        : 50;

      const compositeScore = Math.round(socialScore * 0.35 + burnScore * 0.30 + agentScore * 0.35);
      const clampedScore = Math.max(0, Math.min(100, compositeScore));

      const sentiment =
        clampedScore >= 75 ? "VERY_BULLISH" :
        clampedScore >= 60 ? "BULLISH" :
        clampedScore >= 45 ? "NEUTRAL" :
        clampedScore >= 30 ? "BEARISH" : "VERY_BEARISH";

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                token: symbol,
                period: `${days}d`,
                sentimentScore: clampedScore,
                sentiment,
                breakdown: {
                  social: {
                    score: Math.max(0, Math.min(100, socialScore)),
                    weight: "35%",
                    totalCasts,
                    postedCasts: postedCasts.length,
                    tokenMentions: mentionCasts.length,
                    bullishSignals,
                    bearishSignals,
                  },
                  onChain: {
                    score: burnScore,
                    weight: "30%",
                    totalBurns,
                    confirmedBurns: confirmedBurns.length,
                    totalBurnedTokens: Math.round(totalBurnedTokens),
                    burnVelocity: Math.round(burnVelocity * 10) / 10,
                    burnVelocityLabel: `${Math.round(burnVelocity * 10) / 10} burns/day`,
                  },
                  trading: {
                    score: agentScore,
                    weight: "35%",
                    totalAgents,
                    activeAgents: activeAgents.length,
                    winningAgents,
                    losingAgents,
                    aggregatePnl: Math.round(aggregatePnl * 100) / 100,
                  },
                },
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
