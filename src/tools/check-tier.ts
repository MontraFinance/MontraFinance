import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getErc20Balance } from "../lib/rpc.js";

// ── Tier definitions (mirrored from api/tiers/check.ts) ──

interface TierDef {
  id: string;
  label: string;
  minTokens: number;
  perks: string[];
  burnDiscount: number;
  maxAgents: number;
}

const TIERS: TierDef[] = [
  {
    id: "diamond",
    label: "DIAMOND",
    minTokens: 5_000_000_000,
    burnDiscount: 50,
    maxAgents: 20,
    perks: [
      "Unlimited terminal queries",
      "50% burn discount",
      "Exclusive strategies",
      "Priority agent slots (20 max)",
      "Diamond-only analytics",
    ],
  },
  {
    id: "gold",
    label: "GOLD",
    minTokens: 1_000_000_000,
    burnDiscount: 30,
    maxAgents: 12,
    perks: [
      "30% burn discount",
      "Advanced strategies unlocked",
      "Extra agent slots (12 max)",
      "Gold analytics tier",
    ],
  },
  {
    id: "silver",
    label: "SILVER",
    minTokens: 500_000_000,
    burnDiscount: 15,
    maxAgents: 8,
    perks: [
      "15% burn discount",
      "Silver strategy pack",
      "Enhanced agent monitoring (8 max)",
    ],
  },
  {
    id: "bronze",
    label: "BRONZE",
    minTokens: 100_000_000,
    burnDiscount: 5,
    maxAgents: 5,
    perks: ["5% burn discount", "Basic holder badge"],
  },
  {
    id: "none",
    label: "UNRANKED",
    minTokens: 0,
    burnDiscount: 0,
    maxAgents: 3,
    perks: [],
  },
];

export function registerCheckTier(server: McpServer) {
  server.tool(
    "check_tier",
    "Check a wallet's $MONTRA holder tier (Diamond/Gold/Silver/Bronze/Unranked) with burn discounts, max agents, and perks",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Wallet address to check tier for"),
    },
    async ({ walletAddress }) => {
      const tokenAddress = process.env.BURN_TOKEN_ADDRESS || "";
      const tokenDecimals = parseInt(process.env.BURN_TOKEN_DECIMALS || "18", 10);
      const tokenSymbol = process.env.BURN_TOKEN_SYMBOL || "MONTRA";

      if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  configured: false,
                  tier: "none",
                  label: "UNRANKED",
                  balance: 0,
                  tokenSymbol,
                  burnDiscount: 0,
                  maxAgents: 3,
                  perks: [],
                  nextTier: "bronze",
                  tokensToNext: 100_000_000,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      try {
        const rawBalance = await getErc20Balance(tokenAddress, walletAddress);
        const divisor = BigInt(10) ** BigInt(tokenDecimals);
        const whole = BigInt(rawBalance) / divisor;
        const frac = BigInt(rawBalance) % divisor;
        const fracStr = frac.toString().padStart(tokenDecimals, "0").slice(0, 4);
        const balance = parseFloat(`${whole}.${fracStr}`);

        const matched = TIERS.find((t) => balance >= t.minTokens) || TIERS[TIERS.length - 1];
        const currentIdx = TIERS.findIndex((t) => t.id === matched.id);
        const nextDef = currentIdx > 0 ? TIERS[currentIdx - 1] : null;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  configured: true,
                  tier: matched.id,
                  label: matched.label,
                  balance,
                  tokenSymbol,
                  burnDiscount: matched.burnDiscount,
                  maxAgents: matched.maxAgents,
                  perks: matched.perks,
                  nextTier: nextDef?.id || null,
                  tokensToNext: nextDef ? Math.max(0, nextDef.minTokens - balance) : 0,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error checking tier: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}
