/**
 * Tool: backtest_strategy
 * Run a simulated backtest for a strategy with custom parameters.
 * Uses the strategy's historical backtest data and applies user-defined risk parameters.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { STRATEGIES, type Strategy } from "../lib/strategies.js";

function simulateBacktest(strategy: Strategy, params: {
  budget: number;
  maxDrawdownPct: number;
  maxPositionSizePct: number;
  periods: number;
}) {
  const { budget, maxDrawdownPct, maxPositionSizePct, periods } = params;
  const stats = strategy.backtestStats;

  // Monte Carlo-style simulation using strategy's historical stats
  let equity = budget;
  let peak = budget;
  let maxDrawdown = 0;
  let wins = 0;
  let losses = 0;
  const equityCurve: { period: number; equity: number }[] = [{ period: 0, equity: budget }];

  const tradesPerPeriod = Math.round(stats.totalTrades / 12); // ~monthly periods
  const rng = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  for (let p = 1; p <= periods; p++) {
    const periodTrades = Math.max(1, Math.round(tradesPerPeriod * (0.7 + rng(p * 31) * 0.6)));

    for (let t = 0; t < periodTrades; t++) {
      const posSize = equity * (maxPositionSizePct / 100) * (0.3 + rng(p * 100 + t) * 0.7);
      const isWin = rng(p * 200 + t * 7) < stats.winRate / 100;

      if (isWin) {
        const gain = posSize * (stats.avgReturn / 100) * (0.5 + rng(p * 300 + t) * 1.0);
        equity += gain;
        wins++;
      } else {
        const loss = posSize * (stats.avgReturn / 100) * (0.3 + rng(p * 400 + t) * 0.7) * 1.2;
        equity -= loss;
        losses++;
      }

      // Check drawdown limit
      if (equity > peak) peak = equity;
      const currentDrawdown = ((peak - equity) / peak) * 100;
      if (currentDrawdown > maxDrawdown) maxDrawdown = currentDrawdown;

      if (currentDrawdown > maxDrawdownPct) {
        equity = peak * (1 - maxDrawdownPct / 100);
        break;
      }
    }

    equityCurve.push({ period: p, equity: Math.round(equity * 100) / 100 });
  }

  const totalReturn = ((equity - budget) / budget) * 100;
  const totalTrades = wins + losses;

  return {
    strategy: strategy.name,
    strategyId: strategy.id,
    parameters: {
      initialBudget: budget,
      maxDrawdownPct,
      maxPositionSizePct,
      periodsSimulated: periods,
    },
    results: {
      finalEquity: Math.round(equity * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      totalReturnPct: `${Math.round(totalReturn * 100) / 100}%`,
      totalTrades,
      wins,
      losses,
      winRate: totalTrades > 0 ? Math.round((wins / totalTrades) * 10000) / 100 : 0,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      maxDrawdownPct: `${Math.round(maxDrawdown * 100) / 100}%`,
      drawdownBreached: maxDrawdown >= maxDrawdownPct,
    },
    equityCurve: equityCurve.length <= 24 ? equityCurve : [
      ...equityCurve.slice(0, 3),
      "...",
      ...equityCurve.slice(-3),
    ],
    benchmarkStats: {
      strategyWinRate: stats.winRate,
      strategyAvgReturn: stats.avgReturn,
      strategySharpe: stats.sharpeRatio,
      strategyMaxDrawdown: stats.maxDrawdown,
    },
  };
}

export function registerBacktestStrategy(server: McpServer) {
  server.tool(
    "backtest_strategy",
    "Run a simulated backtest for a trading strategy with custom budget, drawdown, and position size parameters",
    {
      strategy: z.enum(["momentum", "mean_reversion", "arbitrage", "breakout", "grid_trading", "dca"])
        .describe("Strategy ID to backtest"),
      budget: z.number().min(10).max(10000000).describe("Initial budget in USD"),
      maxDrawdownPct: z.number().min(1).max(100).optional().default(20)
        .describe("Max drawdown percentage before stopping"),
      maxPositionSizePct: z.number().min(1).max(100).optional().default(25)
        .describe("Max position size as % of equity"),
      periods: z.number().min(1).max(36).optional().default(12)
        .describe("Number of periods to simulate (months)"),
    },
    async ({ strategy: strategyId, budget, maxDrawdownPct, maxPositionSizePct, periods }) => {
      const strategy = STRATEGIES.find(s => s.id === strategyId);
      if (!strategy) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Strategy not found" }) }],
        };
      }

      const result = simulateBacktest(strategy, {
        budget,
        maxDrawdownPct,
        maxPositionSizePct,
        periods,
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
