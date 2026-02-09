import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";
import { getErc20Balance } from "../lib/rpc.js";

export function registerGetDashboard(server: McpServer) {
  server.tool(
    "get_dashboard",
    "One-shot wallet overview: tier status, active agents with aggregate P&L, recent burns, and agent count — everything in one call",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Wallet address for full dashboard"),
    },
    async ({ walletAddress }) => {
      const supabase = getSupabase();
      const wallet = walletAddress.toLowerCase();

      // Run all queries in parallel
      const [agentsResult, burnsResult, tierResult] = await Promise.allSettled([
        // All agents for this wallet
        supabase
          .from("agents")
          .select("id, config, status, stats, wallet_data, created_at")
          .eq("wallet_address", wallet)
          .order("created_at", { ascending: false }),

        // Recent burns (last 30 days)
        supabase
          .from("burn_transactions")
          .select("amount_burned, complexity, status, created_at")
          .eq("wallet_address", wallet)
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(10),

        // Tier check via on-chain balance
        (async () => {
          const tokenAddress = process.env.BURN_TOKEN_ADDRESS || "";
          const tokenDecimals = parseInt(process.env.BURN_TOKEN_DECIMALS || "18", 10);
          if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
            return { tier: "none", label: "UNRANKED", balance: 0, burnDiscount: 0, maxAgents: 3 };
          }
          const rawBalance = await getErc20Balance(tokenAddress, walletAddress);
          const divisor = BigInt(10) ** BigInt(tokenDecimals);
          const balance = Number(BigInt(rawBalance) / divisor);

          const tiers = [
            { id: "diamond", label: "DIAMOND", min: 5_000_000_000, discount: 50, maxAgents: 20 },
            { id: "gold", label: "GOLD", min: 1_000_000_000, discount: 30, maxAgents: 12 },
            { id: "silver", label: "SILVER", min: 500_000_000, discount: 15, maxAgents: 8 },
            { id: "bronze", label: "BRONZE", min: 100_000_000, discount: 5, maxAgents: 5 },
            { id: "none", label: "UNRANKED", min: 0, discount: 0, maxAgents: 3 },
          ];
          const matched = tiers.find((t) => balance >= t.min) || tiers[tiers.length - 1];
          return {
            tier: matched.id,
            label: matched.label,
            balance,
            burnDiscount: matched.discount,
            maxAgents: matched.maxAgents,
          };
        })(),
      ]);

      // Process agents
      const agents =
        agentsResult.status === "fulfilled" ? agentsResult.value.data ?? [] : [];
      const activeAgents = agents.filter((a: any) => a.status === "active");
      const totalPnl = agents.reduce(
        (sum: number, a: any) => sum + (a.stats?.pnlUsd ?? a.stats?.totalPnl ?? 0),
        0
      );
      const totalTrades = agents.reduce(
        (sum: number, a: any) => sum + (a.stats?.tradeCount ?? a.stats?.totalTrades ?? 0),
        0
      );
      const totalAllocated = agents.reduce(
        (sum: number, a: any) => sum + (a.wallet_data?.allocatedBudget ?? 0),
        0
      );

      // Process burns
      const burns =
        burnsResult.status === "fulfilled" ? burnsResult.value.data ?? [] : [];
      const confirmedBurns = burns.filter(
        (b: any) => b.status === "confirmed" || b.status === "processed"
      );
      const totalTokensBurned = confirmedBurns.reduce(
        (sum: number, b: any) => sum + (b.amount_burned || 0),
        0
      );

      // Process tier
      const tier =
        tierResult.status === "fulfilled"
          ? tierResult.value
          : { tier: "unknown", label: "UNKNOWN", balance: 0, burnDiscount: 0, maxAgents: 3 };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                wallet: walletAddress,
                tier: {
                  ...tier,
                  tokenSymbol: process.env.BURN_TOKEN_SYMBOL || "MONTRA",
                },
                agents: {
                  total: agents.length,
                  active: activeAgents.length,
                  paused: agents.filter((a: any) => a.status === "paused").length,
                  stopped: agents.filter((a: any) => a.status === "stopped").length,
                  deploying: agents.filter((a: any) => a.status === "deploying").length,
                  totalAllocatedBudget: Math.round(totalAllocated * 100) / 100,
                  aggregatePnlUsd: Math.round(totalPnl * 100) / 100,
                  aggregateTradeCount: totalTrades,
                },
                burns30d: {
                  total: burns.length,
                  confirmed: confirmedBurns.length,
                  totalTokensBurned: Math.round(totalTokensBurned),
                  recentBurns: burns.slice(0, 5).map((b: any) => ({
                    amount: b.amount_burned,
                    complexity: b.complexity,
                    status: b.status,
                    date: b.created_at,
                  })),
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
