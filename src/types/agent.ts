export type AgentStatus = 'active' | 'paused' | 'stopped' | 'deploying' | 'error';

export type StrategyId =
  | 'momentum'
  | 'mean_reversion'
  | 'arbitrage'
  | 'breakout'
  | 'grid_trading'
  | 'dca';

export type BudgetCurrency = 'MONTRA' | 'USDC';

export type AgentMode = 'trading' | 'monitor';

export type ExchangeName = 'binance' | 'coinbase' | 'bybit' | 'okx' | 'bitunix';

export interface ExchangeKey {
  id: string;
  exchange: ExchangeName;
  label: string;
  apiKeyMasked: string;
  permissions: string[];
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface AgentConfig {
  name: string;
  strategyId: StrategyId;
  mode: AgentMode;
  budgetAmount?: number;              // CoW trading only
  budgetCurrency?: BudgetCurrency;    // CoW trading only
  maxDrawdownPct: number;
  maxPositionSizePct: number;
  maxTradeSize?: number;              // Absolute $ cap per trade (CEX)
  maxDailyLoss?: number;              // Max daily loss % (CEX)
  mandate: string;
  exchangeKeyId?: string | null;
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
  // Live trading fields
  apiKeyId: string | null;
  apiKeyMasked: string | null;
  agentWalletAddress: string | null;
  fundingTxHash: string | null;
  fundingConfirmed: boolean;
  tradingEnabled: boolean;
  exchangeKeyId: string | null;
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

export interface DeployResult {
  agent: Agent;
  agentWalletAddress: string;
  apiKey: string;
  apiKeyId: string;
  apiKeyMasked: string;
}

import type { RealtimeStatus } from '@/hooks/useRealtimeAgents';

export interface AgentContextType {
  agents: Agent[];
  loading: boolean;
  realtimeStatus: RealtimeStatus;
  exchangeKeys: ExchangeKey[];
  exchangeKeysLoading: boolean;
  deployAgent: (config: AgentConfig, ownerAddress: string) => Promise<DeployResult>;
  pauseAgent: (id: string) => void;
  resumeAgent: (id: string) => void;
  stopAgent: (id: string) => void;
  deleteAgent: (id: string) => void;
  fundAgent: (id: string, amount: number) => void;
  updateAgentStats: (id: string, stats: Partial<AgentStats>, pnlPoint?: PnlDataPoint) => void;
  getAgent: (id: string) => Agent | undefined;
  registerAgentOnChain: (agentId: string) => Promise<{ erc8004AgentId: number; txHash: string }>;
  confirmAgentFunding: (agentId: string, txHash: string, amount: number) => Promise<void>;
  activateTrading: (agentId: string) => Promise<void>;
  withdrawFromAgent: (agentId: string, amount: number, token?: "USDC" | "MONTRA") => Promise<string>;
  addExchangeKey: (exchange: string, label: string, apiKey: string, secret: string, passphrase?: string, permissions?: string[]) => Promise<ExchangeKey>;
  deleteExchangeKey: (keyId: string) => Promise<void>;
  refreshExchangeKeys: () => Promise<void>;
}
