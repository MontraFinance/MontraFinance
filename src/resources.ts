import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { STRATEGIES } from "./lib/strategies.js";
import { getAllBaseTokens } from "./lib/tokens.js";

/**
 * MCP Resources — static reference data that Claude can read on demand.
 * These don't make API calls; they serve curated platform knowledge.
 */

const TIER_DEFINITIONS = [
  {
    id: "diamond", label: "DIAMOND", minTokens: "5B",
    burnDiscount: "50%", maxAgents: 20,
    perks: ["Unlimited terminal queries", "Exclusive strategies", "Priority agent slots", "Diamond-only analytics"],
  },
  {
    id: "gold", label: "GOLD", minTokens: "1B",
    burnDiscount: "30%", maxAgents: 12,
    perks: ["Advanced strategies unlocked", "Extra agent slots", "Gold analytics tier"],
  },
  {
    id: "silver", label: "SILVER", minTokens: "500M",
    burnDiscount: "15%", maxAgents: 8,
    perks: ["Silver strategy pack", "Enhanced agent monitoring"],
  },
  {
    id: "bronze", label: "BRONZE", minTokens: "100M",
    burnDiscount: "5%", maxAgents: 5,
    perks: ["Basic holder badge"],
  },
  {
    id: "none", label: "UNRANKED", minTokens: "0",
    burnDiscount: "0%", maxAgents: 3,
    perks: [],
  },
];

const BURN_PRICING = {
  baseUsd: 0.25,
  tiers: {
    simple: { multiplier: "1x", usdCost: "$0.25", description: "Basic questions, lookups" },
    medium: { multiplier: "3x", usdCost: "$0.75", description: "Queries >200 chars or moderate analysis" },
    complex: { multiplier: "10x", usdCost: "$2.50", description: "Trend analysis, forecasts, comparisons" },
    very_complex: { multiplier: "32x", usdCost: "$8.00", description: "Backtesting, Monte Carlo, portfolio optimization" },
  },
  resourceMultipliers: {
    real_time: "+50% — real-time/live data required",
    historical: "+30% — historical lookback required",
    multiple_markets: "+40% — multi-asset comparison",
  },
};

const PLATFORM_INFO = {
  name: "Montra Finance",
  tagline: "Institutional AI Trading Intelligence — Built on Base",
  chain: "Base (Ethereum L2)",
  token: "$MONTRA",
  website: "montrafinance.com",
  farcaster: "@montrafinance (FID: 2837851)",
  features: [
    "Autonomous trading agents with 6 strategy types",
    "Deflationary burn-to-query AI terminal",
    "5-tier membership system (Diamond → Unranked)",
    "Real-time portfolio scanning on Base chain",
    "Live market data (Coinglass, Helsinki VM, Whale Alert)",
    "Automated Farcaster broadcasting of platform events",
    "MCP server for AI-native integration",
  ],
};

export function registerResources(server: McpServer) {
  // Strategy reference
  server.resource(
    "strategies",
    "montra://strategies",
    { description: "All 6 trading strategies with backtest stats, risk levels, and default configurations" },
    async () => ({
      contents: [
        {
          uri: "montra://strategies",
          mimeType: "application/json",
          text: JSON.stringify(STRATEGIES, null, 2),
        },
      ],
    })
  );

  // Tier reference
  server.resource(
    "tiers",
    "montra://tiers",
    { description: "$MONTRA holder tier definitions — thresholds, discounts, perks, and agent limits" },
    async () => ({
      contents: [
        {
          uri: "montra://tiers",
          mimeType: "application/json",
          text: JSON.stringify(TIER_DEFINITIONS, null, 2),
        },
      ],
    })
  );

  // Token list reference
  server.resource(
    "tokens",
    "montra://tokens",
    { description: "Curated Base chain token list with contract addresses and decimals" },
    async () => ({
      contents: [
        {
          uri: "montra://tokens",
          mimeType: "application/json",
          text: JSON.stringify(
            [
              { symbol: "ETH", name: "Ether", address: "native", decimals: 18 },
              ...getAllBaseTokens(),
            ],
            null,
            2
          ),
        },
      ],
    })
  );

  // Burn pricing reference
  server.resource(
    "burn-pricing",
    "montra://burn-pricing",
    { description: "Burn-to-query pricing model — complexity tiers, resource multipliers, and USD costs" },
    async () => ({
      contents: [
        {
          uri: "montra://burn-pricing",
          mimeType: "application/json",
          text: JSON.stringify(BURN_PRICING, null, 2),
        },
      ],
    })
  );

  // Platform overview
  server.resource(
    "platform",
    "montra://platform",
    { description: "Montra Finance platform overview — features, chain, token, and links" },
    async () => ({
      contents: [
        {
          uri: "montra://platform",
          mimeType: "application/json",
          text: JSON.stringify(PLATFORM_INFO, null, 2),
        },
      ],
    })
  );
}
