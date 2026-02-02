export type StrategyId = "momentum" | "mean_reversion" | "arbitrage" | "breakout" | "grid_trading" | "dca";

export interface StrategyBacktestStats {
  winRate: number;
  avgReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
}

export interface Strategy {
  id: StrategyId;
  name: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  backtestStats: StrategyBacktestStats;
  tags: string[];
  defaultConfig: {
    maxDrawdownPct: number;
    maxPositionSizePct: number;
    budgetCurrency: string;
  };
}

export const STRATEGIES: Strategy[] = [
  {
    id: "momentum",
    name: "MOMENTUM RIDER",
    description: "Rides sustained directional moves using multi-timeframe trend confirmation. Best suited for volatile trending markets.",
    riskLevel: "high",
    backtestStats: { winRate: 58.2, avgReturn: 4.1, sharpeRatio: 1.62, maxDrawdown: 18.4, totalTrades: 1247 },
    tags: ["trend", "crypto", "high-vol"],
    defaultConfig: { maxDrawdownPct: 20, maxPositionSizePct: 25, budgetCurrency: "USDC" },
  },
  {
    id: "mean_reversion",
    name: "MEAN REVERSION",
    description: "Exploits overextended price deviations from statistical means. Performs well in range-bound, choppy conditions.",
    riskLevel: "medium",
    backtestStats: { winRate: 64.7, avgReturn: 2.3, sharpeRatio: 2.14, maxDrawdown: 8.9, totalTrades: 2034 },
    tags: ["oscillation", "range-bound", "stable"],
    defaultConfig: { maxDrawdownPct: 10, maxPositionSizePct: 15, budgetCurrency: "MONTRA" },
  },
  {
    id: "arbitrage",
    name: "ARBITRAGE SEEKER",
    description: "Captures price discrepancies across DEXs and liquidity pools. Delta-neutral with minimal directional exposure.",
    riskLevel: "low",
    backtestStats: { winRate: 71.3, avgReturn: 0.8, sharpeRatio: 3.22, maxDrawdown: 3.1, totalTrades: 4521 },
    tags: ["delta-neutral", "low-vol", "latency"],
    defaultConfig: { maxDrawdownPct: 5, maxPositionSizePct: 40, budgetCurrency: "USDC" },
  },
  {
    id: "breakout",
    name: "BREAKOUT HUNTER",
    description: "Identifies and trades key support/resistance breakouts with volume confirmation. Aggressive entry on volatility expansion.",
    riskLevel: "high",
    backtestStats: { winRate: 49.8, avgReturn: 5.6, sharpeRatio: 1.41, maxDrawdown: 22.7, totalTrades: 891 },
    tags: ["volatility", "momentum", "aggressive"],
    defaultConfig: { maxDrawdownPct: 25, maxPositionSizePct: 30, budgetCurrency: "USDC" },
  },
  {
    id: "grid_trading",
    name: "GRID TRADING",
    description: "Places layered buy/sell orders across a defined price range. Profits from natural price oscillation within the grid.",
    riskLevel: "low",
    backtestStats: { winRate: 77.1, avgReturn: 1.2, sharpeRatio: 2.88, maxDrawdown: 6.2, totalTrades: 3678 },
    tags: ["range", "passive", "steady"],
    defaultConfig: { maxDrawdownPct: 8, maxPositionSizePct: 20, budgetCurrency: "MONTRA" },
  },
  {
    id: "dca",
    name: "DCA ACCUMULATOR",
    description: "Systematic dollar-cost averaging with intelligent timing. Accelerates buys during dips, reduces during pumps.",
    riskLevel: "low",
    backtestStats: { winRate: 68.4, avgReturn: 1.8, sharpeRatio: 2.31, maxDrawdown: 9.8, totalTrades: 1456 },
    tags: ["accumulation", "long-term", "base"],
    defaultConfig: { maxDrawdownPct: 12, maxPositionSizePct: 10, budgetCurrency: "MONTRA" },
  },
];

export const VALID_STRATEGY_IDS = STRATEGIES.map((s) => s.id);

export function deriveAgentWalletAddress(agentId: string): string {
  const suffix = agentId.replace(/-/g, "").slice(-8).toUpperCase();
  return `0xAGNT${suffix}`;
}
