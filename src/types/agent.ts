export type AgentStatus = 'active' | 'paused' | 'stopped' | 'deploying' | 'error';

export type StrategyId =
  | 'momentum'
  | 'mean_reversion'
  | 'arbitrage'
  | 'breakout'
  | 'grid_trading'
  | 'dca';

export type BudgetCurrency = 'MONTRA' | 'USDC';

export interface AgentConfig {
  name: string;
  strategyId: StrategyId;
  budgetAmount: number;
  budgetCurrency: BudgetCurrency;
  maxDrawdownPct: number;
  maxPositionSizePct: number;
  mandate: string;
}

export interface AgentWallet {
  address: string;
  allocatedBudget: number;
  remainingBudget: number;
  currency: BudgetCurrency;
}

export interface AgentStats {
  pnlUsd: number;
  pnlPct: number;
  tradeCount: number;
  winRate: number;
  uptimeSeconds: number;
  lastTradeAt: string | null;
}

export interface PnlDataPoint {
  timestamp: number;
  pnl: number;
}

export interface Agent {
  id: string;
  config: AgentConfig;
  wallet: AgentWallet;
  stats: AgentStats;
  status: AgentStatus;
  pnlHistory: PnlDataPoint[];
  createdAt: string;
  deployedByAddress: string;
  // ERC-8004 Agent Identity (nullable — agent may not be registered on-chain)
  erc8004AgentId: number | null;
  erc8004TxHash: string | null;
  erc8004RegisteredAt: string | null;
}

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
  riskLevel: 'low' | 'medium' | 'high';
  backtestStats: StrategyBacktestStats;
  tags: string[];
  defaultConfig: Partial<AgentConfig>;
}

export interface AgentContextType {
  agents: Agent[];
  loading: boolean;
  deployAgent: (config: AgentConfig, ownerAddress: string) => Promise<Agent>;
  pauseAgent: (id: string) => void;
  resumeAgent: (id: string) => void;
  stopAgent: (id: string) => void;
  deleteAgent: (id: string) => void;
  fundAgent: (id: string, amount: number) => void;
  updateAgentStats: (id: string, stats: Partial<AgentStats>, pnlPoint?: PnlDataPoint) => void;
  getAgent: (id: string) => Agent | undefined;
  registerAgentOnChain: (agentId: string) => Promise<{ erc8004AgentId: number; txHash: string }>;
}
