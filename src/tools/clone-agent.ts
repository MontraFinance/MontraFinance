import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";
import { deriveAgentWalletAddress } from "../lib/strategies.js";

export function registerCloneAgent(server: McpServer) {
  server.tool(
    "clone_agent",
    "Clone an existing agent's strategy and risk config into a new agent. Optionally override budget, name, or risk parameters",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Owner wallet address"),
      sourceAgentId: z.string().min(1).describe("ID of the agent to clone settings from"),
      name: z.string().min(1).max(100).optional().describe("Name for the new agent (defaults to '<source name> (Clone)')"),
      budgetAmount: z.number().positive().optional().describe("Override budget amount (defaults to same as source)"),
      budgetCurrency: z.enum(["MONTRA", "USDC"]).optional().describe("Override budget currency"),
      maxDrawdownPct: z.number().min(1).max(100).optional().describe("Override max drawdown %"),
      maxPositionSizePct: z.number().min(1).max(100).optional().describe("Override max position size %"),
    },
    async ({ walletAddress, sourceAgentId, name, budgetAmount, budgetCurrency, maxDrawdownPct, maxPositionSizePct }) => {
      const supabase = getSupabase();
      const wallet = walletAddress.toLowerCase();

      // Fetch source agent
      const { data: source, error: fetchError } = await supabase
        .from("agents")
        .select("*")
        .eq("id", sourceAgentId)
        .eq("wallet_address", wallet)
        .single();

      if (fetchError || !source) {
        return {
          content: [
            {
              type: "text" as const,
              text: fetchError
                ? `Error fetching source agent: ${fetchError.message}`
                : `Agent ${sourceAgentId} not found or not owned by ${walletAddress}`,
            },
          ],
          isError: true,
        };
      }

      const sourceConfig = source.config || {};
      const sourceWalletData = source.wallet_data || {};

      const newAgentId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const agentWallet = deriveAgentWalletAddress(newAgentId);

      const newBudget = budgetAmount ?? sourceConfig.budgetAmount ?? sourceWalletData.allocatedBudget ?? 1000;
      const newCurrency = budgetCurrency ?? sourceConfig.budgetCurrency ?? sourceWalletData.currency ?? "USDC";

      const newConfig = {
        name: name ?? `${sourceConfig.name || sourceAgentId.slice(0, 8)} (Clone)`,
        strategyId: sourceConfig.strategyId,
        budgetAmount: newBudget,
        budgetCurrency: newCurrency,
        maxDrawdownPct: maxDrawdownPct ?? sourceConfig.maxDrawdownPct ?? 15,
        maxPositionSizePct: maxPositionSizePct ?? sourceConfig.maxPositionSizePct ?? 20,
        mandate: sourceConfig.mandate || `Cloned from ${sourceAgentId}`,
      };

      const { data, error } = await supabase
        .from("agents")
        .insert({
          id: newAgentId,
          wallet_address: wallet,
          config: newConfig,
          wallet_data: {
            address: agentWallet,
            allocatedBudget: newBudget,
            remainingBudget: newBudget,
            currency: newCurrency,
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
          content: [{ type: "text" as const, text: `Failed to clone agent: ${error.message}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                clonedFrom: sourceAgentId,
                newAgent: data,
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
