import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * MCP Prompts — pre-built workflow templates that guide Claude through
 * common multi-step operations on the Montra platform.
 */

export function registerPrompts(server: McpServer) {
  // ── Deploy Agent Workflow ──
  server.prompt(
    "deploy-agent",
    "Step-by-step workflow to deploy a new trading agent — walks through strategy selection, risk parameters, and budget",
    { walletAddress: z.string().optional().describe("Pre-fill wallet address if known") },
    ({ walletAddress }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "I want to deploy a new trading agent on Montra Finance.",
              walletAddress ? `My wallet address is ${walletAddress}.` : "",
              "",
              "Please help me through this process:",
              "1. First, use list_strategies to show me the available strategies with their backtest stats",
              "2. Ask me which strategy I want and my risk tolerance",
              "3. Use check_tier to verify my tier and max agent limit",
              "4. Use list_agents to check how many agents I already have running",
              "5. Help me set appropriate budget, max drawdown, and position size",
              "6. Launch the agent with launch_agent",
              "7. Confirm the deployment and show me the agent details",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        },
      ],
    })
  );

  // ── Portfolio Review Workflow ──
  server.prompt(
    "portfolio-review",
    "Comprehensive portfolio health check — scans holdings, reviews agents, checks burn activity, and suggests optimizations",
    { walletAddress: z.string().optional().describe("Pre-fill wallet address if known") },
    ({ walletAddress }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Give me a comprehensive portfolio review on Montra Finance.",
              walletAddress ? `My wallet address is ${walletAddress}.` : "",
              "",
              "Please run through this checklist:",
              "1. Use get_dashboard for the full overview (tier, agents, burns)",
              "2. Use get_portfolio to scan my on-chain holdings with USD values",
              "3. If I have agents, use compare_agents to rank their performance",
              "4. Check my burn analytics with get_burn_analytics",
              "5. Based on my holdings and risk profile, suggest rebalancing via recompose_portfolio (read-only mode)",
              "6. Summarize: what's working, what isn't, and what I should consider changing",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        },
      ],
    })
  );

  // ── Market Brief Workflow ──
  server.prompt(
    "market-brief",
    "Quick market intelligence brief — pulls derivatives data, quant signals, and whale activity for a given asset",
    {
      symbol: z.string().optional().describe("Asset symbol like BTC or ETH (default: BTC)"),
    },
    ({ symbol }) => {
      const asset = symbol || "BTC";
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `Give me a market intelligence brief for ${asset}.`,
                "",
                "Pull data from all available sources:",
                `1. Use get_market_data with source=helsinki, path=/quant/full/${asset} for quantitative analysis`,
                `2. Use get_market_data with source=coinglass, path=/futures/funding-rate, symbol=${asset} for funding rates`,
                `3. Use get_market_data with source=coinglass, path=/futures/open-interest-his, symbol=${asset} for open interest`,
                "4. Use get_market_data with source=whale_alert to check large recent transactions",
                `5. Use get_token_price to get current ${asset === "BTC" ? "WETH" : asset} price on Base`,
                "",
                "Synthesize everything into a concise brief covering:",
                "- Current price and trend direction",
                "- Derivatives positioning (funding, OI)",
                "- Whale activity signals",
                "- Overall market bias (bullish/neutral/bearish) with confidence level",
              ].join("\n"),
            },
          },
        ],
      };
    }
  );

  // ── Agent Health Check ──
  server.prompt(
    "agent-health-check",
    "Deep dive into a specific agent's performance, risk metrics, and whether it should be adjusted, paused, or rebalanced",
    {
      walletAddress: z.string().optional().describe("Wallet address"),
      agentId: z.string().optional().describe("Agent ID to check"),
    },
    ({ walletAddress, agentId }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Run a health check on my trading agent.",
              walletAddress ? `Wallet: ${walletAddress}` : "",
              agentId ? `Agent ID: ${agentId}` : "",
              "",
              "Please analyze:",
              "1. Use get_agent_performance to pull full stats and P&L history",
              "2. Check if the agent is meeting its strategy's backtest benchmarks (compare against list_strategies)",
              "3. Evaluate budget utilization — is it deploying capital efficiently?",
              "4. Check drawdown against the max drawdown setting",
              "5. Recommend: keep running, adjust parameters, add funds, pause, or stop",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        },
      ],
    })
  );

  // ── Risk Assessment Workflow ──
  server.prompt(
    "risk-assessment",
    "Full portfolio risk assessment — concentration analysis, drawdown exposure, agent warnings, and rebalancing suggestions",
    {
      walletAddress: z.string().optional().describe("Wallet address"),
    },
    ({ walletAddress }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Run a comprehensive risk assessment on my Montra portfolio.",
              walletAddress ? `My wallet: ${walletAddress}` : "",
              "",
              "Please analyze:",
              "1. Use estimate_risk to get the composite risk score and breakdown",
              "2. Use get_portfolio to check my on-chain holdings",
              "3. Use compare_agents to see how agents are performing relative to each other",
              "4. Check gas costs with get_gas_status to see if the network is favorable",
              "5. For any agent flagged with warnings, use get_agent_performance for deeper analysis",
              "",
              "Give me:",
              "- Overall risk score and what's driving it",
              "- Which agents are underperforming or at risk",
              "- Specific actions to reduce risk (pause, rebalance, diversify)",
              "- Whether my strategy concentration is too high",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        },
      ],
    })
  );

  // ── Token Research Workflow ──
  server.prompt(
    "token-research",
    "Research a token before trading — price, liquidity depth, DEX pairs, and whether it's safe to trade at size",
    {
      token: z.string().optional().describe("Token symbol or address to research"),
    },
    ({ token }) => {
      const target = token || "the token";
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `Research ${target} for me before I trade it on Base.`,
                "",
                "Please check:",
                `1. Use search_tokens to find ${target} and get its contract address`,
                "2. Use get_token_price to get the current price",
                "3. Use get_liquidity to check DEX liquidity depth and price impact estimates",
                "4. Check if it's available in any of our supported trading pairs",
                "",
                "Tell me:",
                "- Current price and 24h change",
                "- Total liquidity and whether it's deep enough for my trade size",
                "- Estimated price impact for $100, $1K, $10K trades",
                "- Which DEXs have the most liquidity",
                "- Any red flags (very thin liquidity, low volume, etc.)",
              ].join("\n"),
            },
          },
        ],
      };
    }
  );
}
