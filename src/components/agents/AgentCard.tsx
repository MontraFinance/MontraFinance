import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayCircle, PauseCircle, StopCircle, Wallet, MessageSquare, Trash2, Shield, ShieldAlert, Star, ExternalLink, Key, Zap, ArrowUpRight, Copy, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Agent } from '@/types/agent';
import { MOCK_STRATEGIES } from '@/data/agentMockData';
import { useAgents } from '@/contexts/AgentContext';
import { useWallet } from '@/contexts/WalletContext';
import { fetchCexPortfolioAPI, fetchLatestAiRecommendationAPI } from '@/services/agentService';
import type { CexPortfolioData, LatestAiRecommendation, AiMetrics } from '@/services/agentService';
import AgentStatusBadge from './AgentStatusBadge';
import AgentPerformanceChart from './AgentPerformanceChart';
import AgentFundModal from './AgentFundModal';
import AgentWithdrawModal from './AgentWithdrawModal';
import ReputationBadge from './ReputationBadge';
import GiveFeedbackModal from './GiveFeedbackModal';

const BASE_RPC = "https://mainnet.base.org";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function fetchOnChainBalances(address: string): Promise<{ usdc: number; eth: number }> {
  try {
    const [ethRes, usdcRes] = await Promise.all([
      fetch(BASE_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] }),
      }).then(r => r.json()),
      fetch(BASE_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 2, method: "eth_call",
          params: [{ to: USDC_BASE, data: "0x70a08231" + address.toLowerCase().replace("0x", "").padStart(64, "0") }, "latest"],
        }),
      }).then(r => r.json()),
    ]);
    const ethWei = BigInt(ethRes.result || "0x0");
    const ethVal = Number(ethWei) / 1e18;
    const usdcRaw = BigInt(usdcRes.result || "0x0");
    const usdcVal = Number(usdcRaw) / 1e6;
    return { usdc: usdcVal, eth: ethVal };
  } catch {
    return { usdc: -1, eth: -1 };
  }
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const EXCHANGE_NAMES: Record<string, string> = {
  binance: 'BINANCE',
  coinbase: 'COINBASE',
  bybit: 'BYBIT',
  okx: 'OKX',
  bitunix: 'BITUNIX',
};

const AgentCard = ({ agent }: { agent: Agent }) => {
  const navigate = useNavigate();
  const { pauseAgent, resumeAgent, stopAgent, deleteAgent, registerAgentOnChain, activateTrading } = useAgents();
  const { fullWalletAddress } = useWallet();
  const [showFund, setShowFund] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [activatingTrading, setActivatingTrading] = useState(false);
  const [walletCopied, setWalletCopied] = useState(false);
  const [onChainBalance, setOnChainBalance] = useState<{ usdc: number; eth: number } | null>(null);
  const [cexPortfolio, setCexPortfolio] = useState<CexPortfolioData | null>(null);
  const [latestRec, setLatestRec] = useState<LatestAiRecommendation | null>(null);
  const [aiMetrics, setAiMetrics] = useState<AiMetrics | null>(null);

  const agentAddr = agent.agentWalletAddress || agent.wallet?.address || '';
  // Detect CEX agent from BOTH the DB column AND the config JSON (config is always present)
  const isCexAgent = !!(agent.exchangeKeyId || (agent.config as any)?.exchangeKeyId);
  const isMonitorMode = agent.config?.mode === 'monitor';

  // Safe defaults for nullable DB fields — use Number() to handle NaN, string "NaN", and null
  const safeNum = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };
  const stats = {
    pnlUsd: safeNum(agent.stats?.pnlUsd),
    pnlPct: safeNum(agent.stats?.pnlPct),
    tradeCount: safeNum(agent.stats?.tradeCount),
    winRate: safeNum(agent.stats?.winRate),
    uptimeSeconds: safeNum(agent.stats?.uptimeSeconds),
    lastTradeAt: agent.stats?.lastTradeAt ?? null,
  };
  const walletBudget = {
    allocatedBudget: safeNum(agent.wallet?.allocatedBudget),
    remainingBudget: safeNum(agent.wallet?.remainingBudget),
  };

  // Fetch on-chain balances (for CoW agents)
  useEffect(() => {
    if (isCexAgent || !agentAddr || agentAddr.length < 10) return;
    fetchOnChainBalances(agentAddr).then(setOnChainBalance);
    const interval = setInterval(() => {
      fetchOnChainBalances(agentAddr).then(setOnChainBalance);
    }, 60_000);
    return () => clearInterval(interval);
  }, [agentAddr, isCexAgent]);

  // Fetch CEX portfolio (for exchange agents)
  useEffect(() => {
    if (!isCexAgent || !fullWalletAddress) return;
    fetchCexPortfolioAPI(fullWalletAddress, agent.id).then(data => {
      if (data) setCexPortfolio(data);
    });
    const interval = setInterval(() => {
      fetchCexPortfolioAPI(fullWalletAddress, agent.id).then(data => {
        if (data) setCexPortfolio(data);
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, [isCexAgent, fullWalletAddress, agent.id]);

  // Fetch latest AI recommendation + metrics (for monitor agents)
  useEffect(() => {
    if (!isMonitorMode || !fullWalletAddress) return;
    const fetchAi = () => {
      fetchLatestAiRecommendationAPI(fullWalletAddress, agent.id).then(data => {
        if (data) {
          setLatestRec(data.recommendation);
          setAiMetrics(data.aiMetrics);
        }
      });
    };
    fetchAi();
    const interval = setInterval(fetchAi, 60_000);
    return () => clearInterval(interval);
  }, [isMonitorMode, fullWalletAddress, agent.id]);

  const handleCopyWallet = () => {
    navigator.clipboard.writeText(agentAddr);
    setWalletCopied(true);
    setTimeout(() => setWalletCopied(false), 2000);
  };

  const isOwner = fullWalletAddress?.toLowerCase() === agent.deployedByAddress.toLowerCase();

  const handleActivateTrading = async () => {
    setActivatingTrading(true);
    try {
      await activateTrading(agent.id);
    } catch (err) {
      console.error('Activate trading failed:', err);
    } finally {
      setActivatingTrading(false);
    }
  };

  // Trading status
  const tradingStatusColor = agent.tradingEnabled
    ? 'text-green-500'
    : agent.fundingConfirmed
      ? 'text-yellow-500'
      : 'text-muted-foreground/50';
  const tradingStatusLabel = agent.tradingEnabled
    ? (isMonitorMode ? 'Monitoring Active' : 'Trading Active')
    : agent.fundingConfirmed
      ? 'Funded — Not Trading'
      : 'Unfunded';

  const handleRegisterOnChain = async () => {
    setRegistering(true);
    try {
      await registerAgentOnChain(agent.id);
    } catch (err) {
      console.error('Registration failed:', err);
    } finally {
      setRegistering(false);
    }
  };
  const strategy = MOCK_STRATEGIES.find(s => s.id === agent.config?.strategyId);
  const budgetPct = walletBudget.allocatedBudget > 0
    ? (walletBudget.remainingBudget / walletBudget.allocatedBudget) * 100
    : 0;

  const isDeploying = agent.status === 'deploying';
  // Derive exchange name from portfolio response first, then fall back to looking up the exchange key
  const exchangeName = cexPortfolio?.exchange
    ? EXCHANGE_NAMES[cexPortfolio.exchange] || cexPortfolio.exchange.toUpperCase()
    : (isCexAgent ? 'EXCHANGE' : '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-card border border-border rounded-2xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-mono font-bold text-foreground truncate">{agent.config?.name || 'Agent'}</h3>
          {isMonitorMode && (
            <span className="flex items-center gap-0.5 text-[8px] font-mono text-purple-400 bg-purple-500/10 rounded px-1.5 py-0.5">
              <Eye size={8} /> MONITOR
            </span>
          )}
          {isCexAgent && exchangeName && (
            <span className="text-[8px] font-mono font-bold text-green-400 bg-green-500/10 rounded px-1.5 py-0.5">
              {exchangeName}
            </span>
          )}
        </div>
        <AgentStatusBadge status={agent.status} />
      </div>

      {/* Subheader */}
      <div className="flex items-center gap-2 mb-1 text-[10px] font-mono text-muted-foreground">
        <span className="text-primary">{strategy?.name || agent.config?.strategyId || 'Unknown'}</span>
      </div>

      {/* Agent Wallet Address — Base network, full, copyable + BaseScan link */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <a
          href={`https://basescan.org/address/${agentAddr}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[8px] font-mono font-bold text-blue-400 bg-blue-500/10 rounded px-1.5 py-0.5 shrink-0 hover:bg-blue-500/20 transition flex items-center gap-0.5"
          title="View on BaseScan (Base network)"
        >
          BASE <ExternalLink size={7} />
        </a>
        <button
          onClick={handleCopyWallet}
          className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground bg-secondary/50 rounded px-2 py-1 hover:text-foreground transition break-all text-left"
          title="Click to copy agent wallet address (Base network)"
        >
          <Wallet size={9} className="shrink-0" />
          <span className="break-all">{agentAddr}</span>
          <Copy size={8} className="shrink-0 ml-0.5" />
        </button>
        {walletCopied && <span className="text-[9px] font-mono text-primary">Copied!</span>}
      </div>

      {/* API Key Fingerprint + Trading Status */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {agent.apiKeyMasked && (
          <span className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground bg-secondary/50 rounded-full px-2 py-0.5">
            <Key size={8} />
            {agent.apiKeyMasked}
          </span>
        )}
        <span className={`flex items-center gap-1 text-[9px] font-mono ${tradingStatusColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${agent.tradingEnabled ? 'bg-green-500' : agent.fundingConfirmed ? 'bg-yellow-500' : 'bg-muted-foreground/30'}`} />
          {tradingStatusLabel}
        </span>
      </div>

      {/* ERC-8004 Identity Badge */}
      <div className="flex items-center gap-2 mb-3">
        {agent.erc8004AgentId !== null ? (
          <a
            href={`https://www.8004scan.io/agents/base/${agent.erc8004AgentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono text-primary bg-primary/10 rounded-full px-2 py-0.5 hover:bg-primary/20 transition"
            title="It may take a few minutes for 8004scan to index a newly registered agent."
          >
            <Shield size={10} />
            ERC-8004 #{agent.erc8004AgentId}
            <ExternalLink size={8} />
          </a>
        ) : (
          <button
            onClick={handleRegisterOnChain}
            disabled={registering}
            className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground border border-dashed border-border rounded-full px-2 py-0.5 hover:text-primary hover:border-primary/30 transition disabled:opacity-50"
          >
            <ShieldAlert size={10} />
            {registering ? 'Registering...' : 'Register On-Chain'}
          </button>
        )}
        {agent.erc8004AgentId !== null && (
          <ReputationBadge erc8004AgentId={agent.erc8004AgentId} />
        )}
      </div>

      {isDeploying ? (
        <div className="py-6 text-center">
          <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-[10px] font-mono text-muted-foreground">Initializing agent...</p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-3 text-[10px] font-mono text-muted-foreground">
            {!isMonitorMode && (
              <>
                <div>
                  <p className="mb-1">P&L</p>
                  <p className={`text-sm font-bold ${stats.pnlUsd >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {stats.pnlUsd >= 0 ? '+' : ''}${stats.pnlUsd.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="mb-1">P&L %</p>
                  <p className={`text-sm font-bold ${stats.pnlPct >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {stats.pnlPct >= 0 ? '+' : ''}{stats.pnlPct.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="mb-1">TRADES</p>
                  <p className="text-sm font-bold text-foreground">{stats.tradeCount}</p>
                </div>
                <div>
                  <p className="mb-1">WIN RATE</p>
                  <p className="text-sm font-bold text-foreground">{stats.winRate.toFixed(1)}%</p>
                </div>
              </>
            )}
            {isMonitorMode && (
              <>
                <div>
                  <p className="mb-1">AI WIN RATE</p>
                  <p className={`text-sm font-bold ${(aiMetrics?.winRate || 0) >= 50 ? 'text-green-400' : (aiMetrics?.winRate || 0) > 0 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                    {aiMetrics?.totalScored ? `${aiMetrics.winRate.toFixed(0)}%` : '—'}
                  </p>
                </div>
                <div>
                  <p className="mb-1">AI CHECKS</p>
                  <p className="text-sm font-bold text-purple-400">{aiMetrics?.consultationCount || 0}</p>
                </div>
                <div>
                  <p className="mb-1">STREAK</p>
                  <p className={`text-sm font-bold ${(aiMetrics?.streak || 0) > 0 ? 'text-green-400' : (aiMetrics?.streak || 0) < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                    {aiMetrics?.streak ? (aiMetrics.streak > 0 ? `${aiMetrics.streak}W` : `${Math.abs(aiMetrics.streak)}L`) : '—'}
                  </p>
                </div>
              </>
            )}
            <div>
              <p className="mb-1">UPTIME</p>
              <p className="text-sm font-bold text-foreground">{formatUptime(stats.uptimeSeconds)}</p>
            </div>
            {!isCexAgent && !isMonitorMode && (
              <div>
                <p className="mb-1">BUDGET</p>
                <p className="text-sm font-bold text-foreground">
                  ${walletBudget.remainingBudget.toFixed(0)}
                </p>
              </div>
            )}
            {isCexAgent && !isMonitorMode && (
              <div>
                <p className="mb-1">MAX TRADE</p>
                <p className="text-sm font-bold text-foreground">
                  ${(agent.config as any)?.maxTradeSize?.toFixed(0) || '—'}
                </p>
              </div>
            )}
          </div>

          {/* CEX Portfolio Panel */}
          {isCexAgent && cexPortfolio && cexPortfolio.isCex && (
            <div className="mb-3 bg-secondary/30 rounded-lg px-3 py-2 space-y-2">
              {/* Total Portfolio Header */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {exchangeName} Total Portfolio
                </span>
                <span className="text-sm font-mono font-bold text-foreground">
                  ${(cexPortfolio.totalValueUsd || 0).toFixed(2)}
                </span>
              </div>

              {/* Spot Balances */}
              {cexPortfolio.balances && cexPortfolio.balances.length > 0 && (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-muted-foreground/70 uppercase">Spot</span>
                    <span className="text-[9px] font-mono text-muted-foreground">
                      ${(cexPortfolio.spotTotalUsd || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {cexPortfolio.balances.map(b => (
                      <span key={b.coin} className="text-[10px] font-mono text-foreground font-bold">
                        {b.coin}: {(b.free + b.locked).toFixed(b.coin === 'USDT' || b.coin === 'USDC' ? 2 : 6)}
                        {b.locked > 0 && (
                          <span className="text-yellow-500 font-normal ml-0.5">
                            ({b.locked.toFixed(b.coin === 'USDT' || b.coin === 'USDC' ? 2 : 6)} locked)
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Futures Account */}
              {cexPortfolio.futures?.account && (
                <div className="space-y-0.5 pt-1 border-t border-border/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-muted-foreground/70 uppercase">Futures</span>
                    <span className="text-[9px] font-mono text-muted-foreground">
                      ${(cexPortfolio.futures.totalUsd || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[9px] font-mono">
                    <div>
                      <span className="text-muted-foreground">Available</span>
                      <p className="text-foreground font-bold">${cexPortfolio.futures.account.available.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">In Margin</span>
                      <p className="text-foreground font-bold">${cexPortfolio.futures.account.margin.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Unrealized PNL</span>
                      <p className={`font-bold ${(cexPortfolio.futures.account.crossUnrealizedPNL + cexPortfolio.futures.account.isolationUnrealizedPNL) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(cexPortfolio.futures.account.crossUnrealizedPNL + cexPortfolio.futures.account.isolationUnrealizedPNL) >= 0 ? '+' : ''}
                        ${(cexPortfolio.futures.account.crossUnrealizedPNL + cexPortfolio.futures.account.isolationUnrealizedPNL).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Open Futures Positions */}
              {cexPortfolio.futures?.positions && cexPortfolio.futures.positions.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-border/30">
                  <span className="text-[9px] font-mono text-muted-foreground/70 uppercase">Open Positions</span>
                  {cexPortfolio.futures.positions.map(p => (
                    <div key={p.positionId} className="flex items-center gap-2 text-[9px] font-mono">
                      <span className={p.side === 'LONG' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                        {p.side}
                      </span>
                      <span className="text-foreground">{p.symbol}</span>
                      <span className="text-muted-foreground">{p.leverage}x</span>
                      <span className="text-muted-foreground">qty: {p.qty}</span>
                      <span className="text-muted-foreground">@ {parseFloat(p.avgOpenPrice).toFixed(2)}</span>
                      <span className={parseFloat(p.unrealizedPNL) >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {parseFloat(p.unrealizedPNL) >= 0 ? '+' : ''}${parseFloat(p.unrealizedPNL).toFixed(2)}
                      </span>
                      {p.liqPrice && p.liqPrice !== '0' && (
                        <span className="text-red-500/60">liq: {parseFloat(p.liqPrice).toFixed(2)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Spot Open Orders */}
              {cexPortfolio.openOrders && cexPortfolio.openOrders.length > 0 && (
                <div className="pt-1 border-t border-border/30 space-y-0.5">
                  <span className="text-[9px] font-mono text-muted-foreground/70 uppercase">
                    Open Orders ({cexPortfolio.openOrders.length})
                  </span>
                  {cexPortfolio.openOrders.slice(0, 5).map(o => (
                    <div key={o.orderId} className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground">
                      <span className={o.side === 'buy' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                        {o.side.toUpperCase()}
                      </span>
                      <span>{o.symbol}</span>
                      <span>@ {o.price}</span>
                      <span className="text-foreground">{o.qty}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* No balances anywhere */}
              {(!cexPortfolio.balances || cexPortfolio.balances.length === 0) && !cexPortfolio.futures?.account && (
                <div className="text-[10px] font-mono text-muted-foreground/50">
                  No balances found — account may be empty
                </div>
              )}
            </div>
          )}

          {/* CEX agent still loading or errored */}
          {isCexAgent && (!cexPortfolio || !cexPortfolio.isCex) && (
            <div className="flex items-center gap-3 mb-3 text-[10px] font-mono bg-secondary/30 rounded-lg px-3 py-2">
              <span className="text-muted-foreground">{exchangeName || 'Exchange'} Portfolio:</span>
              <span className={cexPortfolio?.error ? 'text-yellow-500' : 'text-muted-foreground/50'}>
                {cexPortfolio?.error
                  ? (cexPortfolio.error.includes('decrypt')
                    ? 'Key issue — try reconnecting exchange API'
                    : cexPortfolio.error)
                  : 'Loading...'}
              </span>
            </div>
          )}

          {/* Latest AI Recommendation (for monitor agents) */}
          {isMonitorMode && latestRec && (
            <div className="mb-3 bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-purple-400 uppercase font-bold">
                  🧠 Latest AI Signal
                </span>
                <span className="text-[8px] font-mono text-muted-foreground/50">
                  {latestRec.createdAt ? new Date(latestRec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono font-bold ${
                  latestRec.action === 'buy' ? 'text-green-400' :
                  latestRec.action === 'sell' ? 'text-red-400' :
                  'text-yellow-400'
                }`}>
                  {latestRec.action.toUpperCase()}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground">
                  {latestRec.confidence}% confidence
                </span>
              </div>
              {latestRec.reasoning && (
                <p className="text-[9px] font-mono text-muted-foreground leading-relaxed">
                  {latestRec.reasoning.length > 200 ? latestRec.reasoning.slice(0, 200) + '...' : latestRec.reasoning}
                </p>
              )}
            </div>
          )}

          {/* Monitor agent waiting for first check-in */}
          {isMonitorMode && !latestRec && (
            <div className="mb-3 bg-purple-500/5 border border-purple-500/10 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/50">
                <span>🧠</span>
                <span>Waiting for first AI analysis...</span>
                <span className="text-[8px]">(runs every ~5 min)</span>
              </div>
            </div>
          )}

          {/* On-Chain Wallet Balance — only for non-CEX, non-monitor agents */}
          {!isCexAgent && !isMonitorMode && onChainBalance && onChainBalance.usdc >= 0 && (
            <div className="flex items-center gap-3 mb-3 text-[10px] font-mono bg-secondary/30 rounded-lg px-3 py-2">
              <span className="text-muted-foreground">Wallet Balance:</span>
              <span className="text-foreground font-bold">${onChainBalance.usdc.toFixed(2)} USDC</span>
              <span className="text-muted-foreground">|</span>
              <span className={`font-bold ${onChainBalance.eth < 0.0001 ? 'text-yellow-500' : 'text-foreground'}`}>
                {onChainBalance.eth.toFixed(6)} ETH
              </span>
              {onChainBalance.eth < 0.0001 && (
                <span className="text-[8px] text-yellow-500">(needs gas)</span>
              )}
            </div>
          )}

          {/* P&L Chart — trading agents only */}
          {!isMonitorMode && (
            <div className="mb-3">
              <AgentPerformanceChart data={agent.pnlHistory} compact />
            </div>
          )}

          {/* AI Performance Bar — monitor agents only */}
          {isMonitorMode && aiMetrics && aiMetrics.totalScored > 0 && (
            <div className="mb-3">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
                <span>AI Accuracy</span>
                <span>{aiMetrics.winRate.toFixed(0)}% ({aiMetrics.totalScored} scored)</span>
              </div>
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${Math.min(aiMetrics.winRate, 100)}%` }} />
              </div>
            </div>
          )}

          {/* Budget Progress — only for CoW agents with budget */}
          {!isCexAgent && !isMonitorMode && (
            <div className="mb-3">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
                <span>Budget</span>
                <span>{budgetPct.toFixed(0)}% remaining</span>
              </div>
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${budgetPct}%` }} />
              </div>
            </div>
          )}

          {/* CEX Risk Limits bar — trading only */}
          {isCexAgent && !isMonitorMode && (
            <div className="mb-3">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
                <span>Max Drawdown: {(agent.config as any)?.maxDrawdownPct || 15}%</span>
                <span>Max Position: {(agent.config as any)?.maxPositionSizePct || 25}%</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {agent.status === 'active' && (
              <button
                onClick={() => pauseAgent(agent.id)}
                className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 hover:text-yellow-500 hover:border-yellow-500/30 transition"
              >
                <PauseCircle size={12} /> Pause
              </button>
            )}
            {agent.status === 'paused' && (
              <button
                onClick={() => resumeAgent(agent.id)}
                className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 hover:text-primary hover:border-primary/30 transition"
              >
                <PlayCircle size={12} /> Resume
              </button>
            )}
            {(agent.status === 'active' || agent.status === 'paused') && (
              <button
                onClick={() => stopAgent(agent.id)}
                className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 hover:text-destructive hover:border-destructive/30 transition"
              >
                <StopCircle size={12} /> Stop
              </button>
            )}
            {agent.status !== 'stopped' && (
              <>
                <button
                  disabled
                  className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/50 border border-border/50 rounded-lg px-2.5 py-1.5 cursor-not-allowed"
                >
                  <MessageSquare size={12} /> Message
                </button>
                {/* Fund button — only for CoW agents */}
                {!isCexAgent && !isMonitorMode && (
                  <button
                    onClick={() => setShowFund(true)}
                    className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 hover:text-primary hover:border-primary/30 transition ml-auto"
                  >
                    <Wallet size={12} /> Fund
                  </button>
                )}
                {!isCexAgent && agent.fundingConfirmed && walletBudget.remainingBudget > 0 && (
                  <button
                    onClick={() => setShowWithdraw(true)}
                    className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 hover:text-primary hover:border-primary/30 transition"
                  >
                    <ArrowUpRight size={12} /> Withdraw
                  </button>
                )}
                {agent.fundingConfirmed && !agent.tradingEnabled && (
                  <button
                    onClick={handleActivateTrading}
                    disabled={activatingTrading}
                    className="flex items-center gap-1 text-[10px] font-mono text-primary border border-primary/30 rounded-lg px-2.5 py-1.5 hover:bg-primary/10 transition disabled:opacity-50"
                  >
                    <Zap size={12} /> {activatingTrading ? 'Activating...' : isMonitorMode ? 'Start Monitoring' : 'Start Trading'}
                  </button>
                )}
              </>
            )}
            {agent.erc8004AgentId !== null && !isOwner && (
              <button
                onClick={() => setShowFeedback(true)}
                className="flex items-center gap-1 text-[10px] font-mono text-yellow-500 border border-yellow-500/30 rounded-lg px-2.5 py-1.5 hover:bg-yellow-500/10 transition"
              >
                <Star size={12} /> Rate
              </button>
            )}
            {confirmDelete ? (
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[10px] font-mono text-destructive">Delete?</span>
                <button
                  onClick={() => deleteAgent(agent.id)}
                  className="text-[10px] font-mono font-bold text-destructive border border-destructive/40 rounded-lg px-2 py-1 hover:bg-destructive/10 transition"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[10px] font-mono text-muted-foreground border border-border rounded-lg px-2 py-1 hover:text-foreground transition"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className={`flex items-center gap-1 text-[10px] font-mono text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 hover:text-destructive hover:border-destructive/30 transition ${agent.status === 'stopped' ? '' : 'ml-0'}`}
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
        </>
      )}

      <AgentFundModal
        open={showFund}
        onClose={() => setShowFund(false)}
        agent={agent}
      />

      <AgentWithdrawModal
        open={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        agent={agent}
      />

      {agent.erc8004AgentId !== null && (
        <GiveFeedbackModal
          open={showFeedback}
          onClose={() => setShowFeedback(false)}
          agentName={agent.config?.name || 'Agent'}
          erc8004AgentId={agent.erc8004AgentId}
        />
      )}
    </motion.div>
  );
};

export default AgentCard;
