import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Shield, Zap, TrendingUp, Loader2, AlertTriangle, Rocket, CheckCircle } from 'lucide-react';
import { useAgents } from '@/contexts/AgentContext';
import { useWallet } from '@/contexts/WalletContext';
import { MOCK_STRATEGIES } from '@/data/agentMockData';
import type { AgentConfig, DeployResult } from '@/types/agent';

interface Allocation {
  strategyId: string;
  strategyName: string;
  riskLevel: string;
  allocationPct: number;
  allocationUsd: number;
  reasoning: string;
}

interface RecomposeResult {
  success: boolean;
  totalPortfolioValueUsd: number;
  riskTolerance: string;
  allocations: Allocation[];
}

type RiskLevel = 'conservative' | 'moderate' | 'aggressive';

const RISK_OPTIONS: { id: RiskLevel; label: string; icon: typeof Shield; desc: string; color: string }[] = [
  { id: 'conservative', label: 'Conservative', icon: Shield, desc: 'Low risk, stable returns. Emphasis on arbitrage and grid trading.', color: 'text-emerald-600' },
  { id: 'moderate', label: 'Moderate', icon: TrendingUp, desc: 'Balanced risk/reward. Diversified across all strategies.', color: 'text-blue-600' },
  { id: 'aggressive', label: 'Aggressive', icon: Zap, desc: 'High risk, high reward. Emphasis on momentum and breakouts.', color: 'text-orange-600' },
];

const RISK_COLORS: Record<string, string> = {
  low: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  high: 'text-red-600 bg-red-50 border-red-200',
};

interface SmartDeployModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
  portfolioValue: number;
}

const SmartDeployModal = ({ open, onClose, walletAddress, portfolioValue }: SmartDeployModalProps) => {
  const [riskTolerance, setRiskTolerance] = useState<RiskLevel>('moderate');
  const [budgetPct, setBudgetPct] = useState(25);
  const [result, setResult] = useState<RecomposeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deploy state
  const [deploying, setDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState({ current: 0, total: 0 });
  const [deployResults, setDeployResults] = useState<DeployResult[]>([]);
  const [deployComplete, setDeployComplete] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);

  const { deployAgent } = useAgents();
  const { connected, fullWalletAddress } = useWallet();

  const allocatableUsd = Math.round(portfolioValue * (budgetPct / 100) * 100) / 100;

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch('/api/portfolio/recompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          totalValueUsd: allocatableUsd,
          riskTolerance,
        }),
      });

      const data = await resp.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to compute allocation');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleDeployAll = async () => {
    if (!connected || !fullWalletAddress || !result) return;

    const activeAllocations = result.allocations.filter(a => a.allocationPct > 0);
    if (activeAllocations.length === 0) return;

    setDeploying(true);
    setDeployError(null);
    setDeployResults([]);
    setDeployProgress({ current: 0, total: activeAllocations.length });

    const results: DeployResult[] = [];

    for (let i = 0; i < activeAllocations.length; i++) {
      const alloc = activeAllocations[i];
      setDeployProgress({ current: i + 1, total: activeAllocations.length });

      const strategy = MOCK_STRATEGIES.find(s => s.id === alloc.strategyId);

      const config: AgentConfig = {
        name: `${alloc.strategyName} Agent`,
        strategyId: alloc.strategyId as AgentConfig['strategyId'],
        mode: 'trading',
        budgetAmount: alloc.allocationUsd,
        budgetCurrency: strategy?.defaultConfig?.budgetCurrency || 'USDC',
        maxDrawdownPct: strategy?.defaultConfig?.maxDrawdownPct || 15,
        maxPositionSizePct: strategy?.defaultConfig?.maxPositionSizePct || 25,
        mandate: `Execute ${alloc.strategyName} strategy with ${riskTolerance} risk profile. AI-allocated budget: $${alloc.allocationUsd.toFixed(2)}.`,
      };

      try {
        const deployResult = await deployAgent(config, fullWalletAddress);
        results.push(deployResult);
      } catch (err: any) {
        console.error(`Failed to deploy ${alloc.strategyName}:`, err);
        setDeployError(`Failed to deploy ${alloc.strategyName}: ${err.message}`);
        // Continue with remaining agents
      }
    }

    setDeployResults(results);
    setDeploying(false);
    setDeployComplete(true);
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    setDeploying(false);
    setDeployComplete(false);
    setDeployResults([]);
    setDeployError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-primary" />
              <h2 className="text-sm font-mono font-bold">SMART DEPLOY</h2>
            </div>
            <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition">
              <X size={16} />
            </button>
          </div>

          <div className="px-5 py-4 space-y-5">
            {/* Portfolio value */}
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Portfolio Value</p>
              <p className="text-2xl font-mono font-bold">${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>

            {/* Budget slider */}
            {!deployComplete && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase">Budget to Allocate</p>
                  <p className="text-xs font-mono font-bold text-primary">{budgetPct}% &mdash; ${allocatableUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={budgetPct}
                  onChange={(e) => setBudgetPct(Number(e.target.value))}
                  disabled={!!result}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[9px] font-mono text-muted-foreground mt-1">
                  <span>5%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            )}

            {/* Risk tolerance */}
            {!deployComplete && !result && (
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase mb-2">Risk Tolerance</p>
                <div className="grid grid-cols-3 gap-2">
                  {RISK_OPTIONS.map(({ id, label, icon: Icon, desc, color }) => (
                    <button
                      key={id}
                      onClick={() => setRiskTolerance(id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition text-center ${
                        riskTolerance === id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30 hover:bg-secondary/50'
                      }`}
                    >
                      <Icon size={16} className={riskTolerance === id ? 'text-primary' : color} />
                      <span className="text-[10px] font-mono font-bold">{label}</span>
                      <span className="text-[8px] font-mono text-muted-foreground leading-tight">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Analyze button */}
            {!result && !deployComplete && (
              <button
                onClick={handleAnalyze}
                disabled={loading || allocatableUsd <= 0}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-3 hover:bg-primary/80 transition disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> ANALYZING...
                  </>
                ) : (
                  <>
                    <Brain size={14} /> GENERATE ALLOCATION
                  </>
                )}
              </button>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-xs font-mono text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle size={12} /> {error}
              </div>
            )}

            {/* Deploying progress */}
            {deploying && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 text-center">
                <Loader2 size={28} className="animate-spin mx-auto mb-3 text-primary" />
                <p className="text-xs font-mono font-bold text-primary">
                  DEPLOYING AGENT {deployProgress.current} OF {deployProgress.total}
                </p>
                <p className="text-[9px] font-mono text-muted-foreground mt-1">
                  Creating wallets and generating API keys...
                </p>
              </motion.div>
            )}

            {/* Deploy complete */}
            {deployComplete && deployResults.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono text-primary font-bold">
                  <CheckCircle size={14} />
                  {deployResults.length} AGENT{deployResults.length > 1 ? 'S' : ''} DEPLOYED SUCCESSFULLY
                </div>

                {deployResults.map((r) => (
                  <div key={r.agent.id} className="bg-secondary/30 border border-border rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold">{r.agent.config.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">${r.agent.config.budgetAmount.toLocaleString()}</span>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      Strategy: {r.agent.config.strategyId.toUpperCase()}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      Wallet: {r.agentWalletAddress.slice(0, 10)}...{r.agentWalletAddress.slice(-6)}
                    </div>
                  </div>
                ))}

                {deployError && (
                  <div className="flex items-center gap-2 text-xs font-mono text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle size={12} /> {deployError}
                  </div>
                )}

                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                  <p className="text-[10px] font-mono text-muted-foreground text-center">
                    Fund each agent with USDC on Base to start trading. Visit the Agents tab to manage and fund your fleet.
                  </p>
                </div>

                <button
                  onClick={handleClose}
                  className="w-full text-xs font-mono font-bold bg-primary text-primary-foreground rounded-lg px-4 py-2.5 hover:bg-primary/80 transition"
                >
                  GO TO AGENTS
                </button>
              </motion.div>
            )}

            {/* Results (allocation view) */}
            {result && !deploying && !deployComplete && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-primary rounded-full" />
                  <p className="text-xs font-mono font-bold uppercase">Recommended Allocation</p>
                </div>

                {result.allocations
                  .filter((a) => a.allocationPct > 0)
                  .sort((a, b) => b.allocationPct - a.allocationPct)
                  .map((alloc) => (
                    <div key={alloc.strategyId} className="bg-secondary/30 border border-border rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold">{alloc.strategyName}</span>
                          <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${RISK_COLORS[alloc.riskLevel] || 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                            {alloc.riskLevel.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-primary">{alloc.allocationPct}%</span>
                          <span className="text-[10px] font-mono text-muted-foreground ml-2">${alloc.allocationUsd.toLocaleString()}</span>
                        </div>
                      </div>
                      {/* Allocation bar */}
                      <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${alloc.allocationPct}%` }}
                          transition={{ duration: 0.6 }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground">{alloc.reasoning}</p>
                    </div>
                  ))}

                {/* Summary */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Total Allocated</span>
                    <span className="font-bold text-primary">${allocatableUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono mt-1">
                    <span className="text-muted-foreground">Strategies Active</span>
                    <span className="font-bold">{result.allocations.filter((a) => a.allocationPct > 0).length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono mt-1">
                    <span className="text-muted-foreground">Risk Profile</span>
                    <span className="font-bold capitalize">{result.riskTolerance}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => setResult(null)}
                    className="flex-1 text-xs font-mono text-muted-foreground border border-border rounded-lg px-4 py-2.5 hover:text-foreground hover:bg-secondary transition"
                  >
                    RECONFIGURE
                  </button>
                  {connected ? (
                    <button
                      onClick={handleDeployAll}
                      disabled={deploying}
                      className="flex-1 flex items-center justify-center gap-2 text-xs font-mono font-bold bg-primary text-primary-foreground rounded-lg px-4 py-2.5 hover:bg-primary/80 transition disabled:opacity-40"
                    >
                      <Rocket size={14} /> DEPLOY ALL
                    </button>
                  ) : (
                    <button
                      onClick={handleClose}
                      className="flex-1 text-xs font-mono font-bold bg-primary text-primary-foreground rounded-lg px-4 py-2.5 hover:bg-primary/80 transition"
                    >
                      DONE
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SmartDeployModal;
