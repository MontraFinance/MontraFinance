import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { STRATEGIES, deriveAgentWalletAddress } from "../lib/strategies.js";
import { getSupabase } from "../lib/supabase.js";

const WEIGHT_MATRIX: Record<string, Record<string, number>> = {
  conservative: {
    momentum: 5,
    mean_reversion: 15,
    arbitrage: 30,
    breakout: 5,
    grid_trading: 25,
    dca: 20,
  },
  moderate: {
    momentum: 15,
    mean_reversion: 20,
    arbitrage: 20,
    breakout: 10,
    grid_trading: 20,
    dca: 15,
  },
  aggressive: {
    momentum: 30,
    mean_reversion: 10,
    arbitrage: 10,
    breakout: 25,
    grid_trading: 10,
    dca: 15,
  },
};

interface AllocationSuggestion {
  strategyId: string;
  strategyName: string;
  riskLevel: string;
  allocationPct: number;
  allocationUsd: number;
  reasoning: string;
}

interface ExecutionAction {
  action: "deploy" | "adjust" | "stop";
  strategyId: string;
  agentId?: string;
  budgetUsd: number;
  detail: string;
}

export function registerRecomposePortfolio(server: McpServer) {
  server.tool(
    "recompose_portfolio",
    "Suggest and optionally execute target strategy allocations based on current holdings and risk tolerance",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Wallet address for context"),
      holdings: z
        .array(
          z.object({
            asset: z.string().describe("Asset name or symbol (e.g., ETH, USDC)"),
            valueUsd: z.number().describe("Current value in USD"),
          })
        )
        .describe("Current portfolio holdings with USD values"),
      riskTolerance: z
        .enum(["conservative", "moderate", "aggressive"])
        .describe("Risk tolerance level"),
      execute: z
        .boolean()
        .optional()
        .describe("If true, deploy/adjust/stop agents to match the target allocation. Default: false (read-only)."),
    },
    async ({ walletAddress, holdings, riskTolerance, execute }) => {
      const totalValue = holdings.reduce((sum, h) => sum + h.valueUsd, 0);
      const weights = WEIGHT_MATRIX[riskTolerance];

      // Build allocation suggestions
      const allocations: AllocationSuggestion[] = STRATEGIES.map((strategy) => {
        const pct = weights[strategy.id];
        const allocatedUsd = Math.round((totalValue * pct) / 100 * 100) / 100;
        const { backtestStats } = strategy;

        let reasoning: string;
        if (pct >= 25) {
          reasoning = `High allocation — ${strategy.name} has a ${backtestStats.sharpeRatio} Sharpe ratio with ${backtestStats.winRate}% win rate, well-suited for ${riskTolerance} profile.`;
        } else if (pct >= 15) {
          reasoning = `Moderate allocation — ${strategy.name} provides ${backtestStats.avgReturn}% avg return with ${backtestStats.maxDrawdown}% max drawdown.`;
        } else {
          reasoning = `Low allocation — ${strategy.name} adds diversification; ${backtestStats.totalTrades} historical trades at ${backtestStats.winRate}% win rate.`;
        }

        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          riskLevel: strategy.riskLevel,
          allocationPct: pct,
          allocationUsd: allocatedUsd,
          reasoning,
        };
      });

      const response: Record<string, unknown> = {
        wallet: walletAddress,
        totalPortfolioValueUsd: totalValue,
        riskTolerance,
        suggestedAllocations: allocations,
      };

      // Execute mode: deploy/adjust/stop agents
      if (execute) {
        const actions = await executeRecomposition(walletAddress, allocations, totalValue);
        response.executed = true;
        response.actions = actions;
        response.summary = `Executed ${actions.length} actions: ${actions.filter((a) => a.action === "deploy").length} deployed, ${actions.filter((a) => a.action === "adjust").length} adjusted, ${actions.filter((a) => a.action === "stop").length} stopped.`;
      } else {
        response.executed = false;
        response.disclaimer = "This is a read-only recommendation. Pass execute: true to deploy/adjust agents.";
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }
  );
}

async function executeRecomposition(
  walletAddress: string,
  allocations: AllocationSuggestion[],
  totalValue: number
): Promise<ExecutionAction[]> {
  const supabase = getSupabase();
  const actions: ExecutionAction[] = [];
  const wallet = walletAddress.toLowerCase();

  // Fetch existing agents for this wallet
  const { data: existingAgents, error: fetchError } = await supabase
    .from("agents")
    .select("*")
    .eq("wallet_address", wallet);

  if (fetchError) {
    throw new Error(`Failed to fetch agents: ${fetchError.message}`);
  }

  const agents = existingAgents || [];

  // Map existing agents by strategy ID
  const agentsByStrategy = new Map<string, any>();
  for (const agent of agents) {
    const strategyId = agent.config?.strategyId;
    if (strategyId && agent.status !== "stopped") {
      agentsByStrategy.set(strategyId, agent);
    }
  }

  for (const allocation of allocations) {
    const existingAgent = agentsByStrategy.get(allocation.strategyId);
    const strategy = STRATEGIES.find((s) => s.id === allocation.strategyId);
    if (!strategy) continue;

    if (allocation.allocationUsd <= 0) {
      // Stop agent if it exists and has zero allocation
      if (existingAgent) {
        const { error } = await supabase
          .from("agents")
          .update({ status: "stopped" })
          .eq("id", existingAgent.id);

        actions.push({
          action: "stop",
          strategyId: allocation.strategyId,
          agentId: existingAgent.id,
          budgetUsd: 0,
          detail: error
            ? `Failed to stop: ${error.message}`
            : `Stopped agent ${existingAgent.id} (${strategy.name}) — 0% allocation.`,
        });
      }
      continue;
    }

    if (existingAgent) {
      // Adjust existing agent's budget
      const updatedWallet = {
        ...existingAgent.wallet_data,
        allocatedBudget: allocation.allocationUsd,
        remainingBudget: allocation.allocationUsd,
      };

      const { error } = await supabase
        .from("agents")
        .update({
          wallet_data: updatedWallet,
          status: "active",
        })
        .eq("id", existingAgent.id);

      actions.push({
        action: "adjust",
        strategyId: allocation.strategyId,
        agentId: existingAgent.id,
        budgetUsd: allocation.allocationUsd,
        detail: error
          ? `Failed to adjust: ${error.message}`
          : `Adjusted ${strategy.name} agent budget to $${allocation.allocationUsd} (${allocation.allocationPct}%).`,
      });
    } else {
      // Deploy new agent
      const agentId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const agentWallet = deriveAgentWalletAddress(agentId);

      const { error } = await supabase.from("agents").insert({
        id: agentId,
        wallet_address: wallet,
        config: {
          name: strategy.name,
          strategyId: strategy.id,
          budgetAmount: allocation.allocationUsd,
          budgetCurrency: strategy.defaultConfig.budgetCurrency,
          maxDrawdownPct: strategy.defaultConfig.maxDrawdownPct,
          maxPositionSizePct: strategy.defaultConfig.maxPositionSizePct,
          mandate: `Auto-deployed via recomposition: ${strategy.id} strategy with ${allocation.allocationPct}% allocation.`,
        },
        wallet_data: {
          address: agentWallet,
          allocatedBudget: allocation.allocationUsd,
          remainingBudget: allocation.allocationUsd,
          currency: strategy.defaultConfig.budgetCurrency,
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
      });

      actions.push({
        action: "deploy",
        strategyId: allocation.strategyId,
        agentId,
        budgetUsd: allocation.allocationUsd,
        detail: error
          ? `Failed to deploy: ${error.message}`
          : `Deployed new ${strategy.name} agent with $${allocation.allocationUsd} budget (${allocation.allocationPct}%).`,
      });
    }
  }

  return actions;
}
