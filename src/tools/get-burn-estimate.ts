import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getTokenPrices } from "../lib/prices.js";

// ── Complexity detection (ported from api/lib/complexity.ts) ──

type ComplexityLevel = "simple" | "medium" | "complex" | "very_complex";

const USD_COST_TIERS: Record<ComplexityLevel, number> = {
  simple: 1,
  medium: 3,
  complex: 10,
  very_complex: 32,
};

const VERY_COMPLEX_INDICATORS = [
  "backtest", "monte carlo", "portfolio", "correlation",
  "regression", "optimization", "strategy",
];

const COMPLEX_INDICATORS = [
  "analyze", "compare", "trend", "forecast",
  "prediction", "signal", "indicator",
];

function analyzeComplexity(query: string): ComplexityLevel {
  const lower = query.toLowerCase();
  if (VERY_COMPLEX_INDICATORS.some((i) => lower.includes(i))) return "very_complex";
  if (COMPLEX_INDICATORS.some((i) => lower.includes(i))) return "complex";
  if (query.length > 200) return "medium";
  return "simple";
}

function detectResourceMultipliers(query: string): { multiplier: number; tags: string[] } {
  const lower = query.toLowerCase();
  let multiplier = 1;
  const tags: string[] = [];

  if (/real.?time|live|current|now|today/.test(lower)) {
    multiplier += 0.5;
    tags.push("real_time");
  }
  if (/historical|past|history|last|previous|year|month|week/.test(lower)) {
    multiplier += 0.3;
    tags.push("historical");
  }
  if (/compare|vs|versus|and|both|multiple/.test(lower)) {
    multiplier += 0.4;
    tags.push("multiple_markets");
  }
  return { multiplier, tags };
}

// ── Tool registration ──

export function registerGetBurnEstimate(server: McpServer) {
  server.tool(
    "get_burn_estimate",
    "Estimate the $MONTRA burn cost for an AI terminal query based on complexity, resource requirements, and live token price",
    {
      query: z.string().min(1).max(2000).describe("The query text to estimate burn cost for"),
    },
    async ({ query }) => {
      const baseUsd = parseFloat(process.env.BURN_USD_COST || "0.25");
      const fallbackTokens = parseInt(process.env.BURN_FALLBACK_TOKENS || "200", 10);
      const tokenAddress = process.env.BURN_TOKEN_ADDRESS || "";
      const tokenDecimals = parseInt(process.env.BURN_TOKEN_DECIMALS || "18", 10);
      const tokenSymbol = process.env.BURN_TOKEN_SYMBOL || "MONTRA";

      const complexity = analyzeComplexity(query);
      const tierMultiplier = USD_COST_TIERS[complexity];
      const { multiplier: resourceMultiplier, tags: multipliers } = detectResourceMultipliers(query);

      const usdCost = parseFloat((baseUsd * tierMultiplier * resourceMultiplier).toFixed(2));

      // Fetch live token price
      let priceUsd: number | null = null;
      let tokenAmount: number;

      if (tokenAddress) {
        const prices = await getTokenPrices([tokenAddress]);
        priceUsd = prices[tokenAddress.toLowerCase()] ?? null;
      }

      if (priceUsd && priceUsd > 0) {
        tokenAmount = Math.ceil(usdCost / priceUsd);
      } else {
        tokenAmount = Math.ceil(fallbackTokens * (usdCost / baseUsd));
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                burnRequired: true,
                tokenAmount,
                complexity,
                multipliers,
                usdCost,
                priceUsd,
                tokenAddress: tokenAddress || null,
                tokenDecimals,
                tokenSymbol,
                deadAddress: "0x000000000000000000000000000000000000dEaD",
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
