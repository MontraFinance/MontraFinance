import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";

export function registerGetBurnAnalytics(server: McpServer) {
  server.tool(
    "get_burn_analytics",
    "Get aggregated burn analytics for a wallet: total burns, tokens burned, complexity breakdown, daily activity (last 90 days)",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Wallet address to get burn analytics for"),
    },
    async ({ walletAddress }) => {
      const supabase = getSupabase();
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const { data: burns, error } = await supabase
        .from("burn_transactions")
        .select("amount_burned, complexity, status, created_at")
        .eq("wallet_address", walletAddress.toLowerCase())
        .gte("created_at", cutoff)
        .order("created_at", { ascending: true });

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching burn analytics: ${error.message}` }],
          isError: true,
        };
      }

      const records = burns || [];
      const totalBurns = records.length;
      const confirmedBurns = records.filter((b) => b.status === "confirmed" || b.status === "processed");
      const totalTokensBurned = confirmedBurns.reduce((sum, b) => sum + (b.amount_burned || 0), 0);

      // Complexity breakdown
      const complexityMap: Record<string, number> = {};
      for (const b of records) {
        const c = b.complexity || "simple";
        complexityMap[c] = (complexityMap[c] || 0) + 1;
      }
      const complexityBreakdown = Object.entries(complexityMap).map(([name, count]) => ({
        name,
        count,
      }));

      // Status breakdown
      const statusMap: Record<string, number> = {};
      for (const b of records) {
        const s = b.status || "unknown";
        statusMap[s] = (statusMap[s] || 0) + 1;
      }
      const statusBreakdown = Object.entries(statusMap).map(([name, count]) => ({
        name,
        count,
      }));

      // Daily activity
      const dailyMap: Record<string, { burns: number; tokens: number }> = {};
      for (const b of records) {
        const day = b.created_at.slice(0, 10);
        if (!dailyMap[day]) dailyMap[day] = { burns: 0, tokens: 0 };
        dailyMap[day].burns += 1;
        if (b.status === "confirmed" || b.status === "processed") {
          dailyMap[day].tokens += b.amount_burned || 0;
        }
      }
      const dailyActivity = Object.entries(dailyMap)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                wallet: walletAddress,
                totalBurns,
                totalTokensBurned,
                confirmedCount: confirmedBurns.length,
                complexityBreakdown,
                statusBreakdown,
                dailyActivity,
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
