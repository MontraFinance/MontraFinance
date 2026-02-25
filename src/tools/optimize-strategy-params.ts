/**
 * Tool: optimize_strategy_params
 * Given a strategy, run multiple parameter sweeps and recommend
 * optimal drawdown %, position size, and budget allocation.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { STRATEGIES, type Strategy } from "../lib/strategies.js";

function runSweep(
  strategy: Strategy,
  budget: number,
  drawdownPct: number,
  positionSizePct: number,
  periods: number
) {
  const stats = strategy.backtestStats;
  let equity = budget;
  let peak = budget;
  let maxDD = 0;
  let wins = 0;
  let losses = 0;

  const tradesPerPeriod = Math.round(stats.totalTrades / 12);
  const rng = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  for (let p = 1; p <= periods; p++) {
    const pt = Math.max(1, Math.round(tradesPerPeriod * (0.7 + rng(p * 31) * 0.6)));
    for (let t = 0; t < pt; t++) {
      const posSize = equity * (positionSizePct / 100) * (0.3 + rng(p * 100 + t) * 0.7);
      const isWin = rng(p * 200 + t * 7) < stats.winRate / 100;

      if (isWin) {
        equity += posSize * (stats.avgReturn / 100) * (0.5 + rng(p * 300 + t) * 1.0);
        wins++;
      } else {
        equity -= posSize * (stats.avgReturn / 100) * (0.3 + rng(p * 400 + t) * 0.7) * 1.2;
        losses++;
      }

      if (equity > peak) peak = equity;
      const dd = ((peak - equity) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
      if (dd > drawdownPct) {
        equity = peak * (1 - drawdownPct / 100);
        break;
      }
    }
  }

  const totalReturn = ((equity - budget) / budget) * 100;
  const totalTrades = wins + losses;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  // Simplified Sharpe: return / volatility proxy
  const sharpeProxy = maxDD > 0 ? totalReturn / maxDD : totalReturn;

  return {
    drawdownPct,
    positionSizePct,
    finalEquity: Math.round(equity * 100) / 100,
    totalReturnPct: Math.round(totalReturn * 100) / 100,
    maxDrawdownHit: Math.round(maxDD * 100) / 100,
    drawdownBreached: maxDD >= drawdownPct,
    winRate: Math.round(winRate * 100) / 100,
    totalTrades,
    sharpeProxy: Math.round(sharpeProxy * 100) / 100,
  };
}

export function registerOptimizeStrategyParams(server: McpServer) {
  server.tool(
    "optimize_strategy_params",
    "Find optimal strategy parameters by running parameter sweeps across drawdown limits and position sizes. Returns ranked configurations by risk-adjusted return",
    {
      strategy: z
        .enum(["momentum", "mean_reversion", "arbitrage", "breakout", "grid_trading", "dca"])
        .describe("Strategy ID to optimize"),
      budget: z.number().min(100).max(10000000).describe("Budget to optimize for (USD)"),
      periods: z
        .number()
        .int()
        .min(3)
        .max(36)
        .optional()
        .default(12)
        .describe("Months to simulate per sweep (default: 12)"),
      optimizeFor: z
        .enum(["return", "sharpe", "safety"])
        .optional()
        .default("sharpe")
        .describe("Optimization target: max return, best risk-adjusted (sharpe), or safest"),
    },
    async ({ strategy: strategyId, budget, periods, optimizeFor }) => {
      const strategy = STRATEGIES.find((s) => s.id === strategyId);
      if (!strategy) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Strategy not found" }) }],
          isError: true,
        };
      }

      // Parameter grid
      const drawdowns = [5, 10, 15, 20, 25, 30];
      const positionSizes = [5, 10, 15, 20, 25, 30, 40];

      const results: ReturnType<typeof runSweep>[] = [];

      for (const dd of drawdowns) {
        for (const ps of positionSizes) {
          results.push(runSweep(strategy, budget, dd, ps, periods));
        }
      }

      // Sort based on optimization target
      const sorted = [...results].sort((a, b) => {
        if (optimizeFor === "return") return b.totalReturnPct - a.totalReturnPct;
        if (optimizeFor === "safety") {
          // Prefer low drawdown, then return
          const safetyA = (100 - a.maxDrawdownHit) + a.totalReturnPct * 0.5;
          const safetyB = (100 - b.maxDrawdownHit) + b.totalReturnPct * 0.5;
          return safetyB - safetyA;
        }
        // Default: sharpe proxy
        return b.sharpeProxy - a.sharpeProxy;
      });

      const best = sorted[0];
      const top5 = sorted.slice(0, 5);
      const worst = sorted[sorted.length - 1];

      // Compute default params performance
      const defaultRun = runSweep(
        strategy,
        budget,
        strategy.defaultConfig.maxDrawdownPct,
        strategy.defaultConfig.maxPositionSizePct,
        periods
      );

      const improvement = best.totalReturnPct - defaultRun.totalReturnPct;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                strategy: strategy.name,
                strategyId: strategy.id,
                budget,
                periods,
                optimizeFor,
                totalSweeps: results.length,
                recommended: {
                  maxDrawdownPct: best.drawdownPct,
                  maxPositionSizePct: best.positionSizePct,
                  expectedReturn: `${best.totalReturnPct}%`,
                  expectedFinalEquity: best.finalEquity,
                  maxDrawdownHit: `${best.maxDrawdownHit}%`,
                  winRate: `${best.winRate}%`,
                  sharpeProxy: best.sharpeProxy,
                },
                vsDefault: {
                  defaultDrawdownPct: strategy.defaultConfig.maxDrawdownPct,
                  defaultPositionSizePct: strategy.defaultConfig.maxPositionSizePct,
                  defaultReturn: `${defaultRun.totalReturnPct}%`,
                  improvementPct: `${Math.round(improvement * 100) / 100}%`,
                  better: improvement > 0,
                },
                top5Configurations: top5.map((r, i) => ({
                  rank: i + 1,
                  drawdownPct: r.drawdownPct,
                  positionSizePct: r.positionSizePct,
                  returnPct: `${r.totalReturnPct}%`,
                  maxDD: `${r.maxDrawdownHit}%`,
                  sharpe: r.sharpeProxy,
                })),
                worstConfiguration: {
                  drawdownPct: worst.drawdownPct,
                  positionSizePct: worst.positionSizePct,
                  returnPct: `${worst.totalReturnPct}%`,
                  maxDD: `${worst.maxDrawdownHit}%`,
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
