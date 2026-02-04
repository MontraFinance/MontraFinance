import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";
import { VALID_STRATEGY_IDS, deriveAgentWalletAddress } from "../lib/strategies.js";
import type { StrategyId } from "../lib/strategies.js";

export function registerLaunchAgent(server: McpServer) {
  server.tool(
    "launch_agent",
    "Deploy a new trading agent to Supabase with a chosen strategy and risk parameters",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Owner wallet address"),
      name: z.string().min(1).max(100).describe("Display name for the agent"),
      strategyId: z.enum(VALID_STRATEGY_IDS as [string, ...string[]]).describe("Strategy ID to use"),
      budgetAmount: z.number().positive().describe("Budget amount to allocate"),
      budgetCurrency: z.enum(["MONTRA", "USDC"]).describe("Budget currency"),
      maxDrawdownPct: z.number().min(1).max(100).optional().describe("Max drawdown percentage (default from strategy)"),
      maxPositionSizePct: z.number().min(1).max(100).optional().describe("Max position size percentage (default from strategy)"),
      mandate: z.string().optional().describe("Free-text trading mandate / instructions"),
    },
    async ({ walletAddress, name, strategyId, budgetAmount, budgetCurrency, maxDrawdownPct, maxPositionSizePct, mandate }) => {
      const agentId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const agentWallet = deriveAgentWalletAddress(agentId);

      const config = {
        name,
        strategyId,
        budgetAmount,
        budgetCurrency,
        maxDrawdownPct: maxDrawdownPct ?? 15,
        maxPositionSizePct: maxPositionSizePct ?? 20,
        mandate: mandate ?? `Execute ${strategyId} strategy with ${budgetCurrency} budget`,
      };

      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("agents")
        .insert({
          id: agentId,
          wallet_address: walletAddress.toLowerCase(),
          config,
          wallet_data: {
            address: agentWallet,
            allocatedBudget: budgetAmount,
            remainingBudget: budgetAmount,
            currency: budgetCurrency,
          },
          stats: {
            pnlUsd: 0,
            pnlPct: 0,
            tradeCount: 0,
            winRate: 0,
            uptimeSeconds: 0,
            lastTradeAt: null,
          },
          status: "deploying",
          pnl_history: [],
        })
        .select("*")
        .single();

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Failed to deploy agent: ${error.message}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: true, agent: data }, null, 2),
          },
        ],
      };
    }
  );
}
