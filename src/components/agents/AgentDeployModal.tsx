import { useState } from 'react';
import { Bot, CheckCircle, Rocket, Shield, Copy, ExternalLink, Wallet, Zap, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Strategy, AgentConfig, AgentMode, StrategyId, DeployResult } from '@/types/agent';
import { MOCK_STRATEGIES } from '@/data/agentMockData';
import { useAgents } from '@/contexts/AgentContext';
import { useWallet } from '@/contexts/WalletContext';
import { transferUsdcToAgent } from '@/lib/usdc';
import ExchangeKeySelect from './ExchangeKeySelect';

interface AgentDeployModalProps {
  open: boolean;
  onClose: () => void;
  prefillStrategy?: Strategy | null;
}

type WizardStep = 'config' | 'deploying' | 'fund' | 'success';

const AgentDeployModal = ({ open, onClose, prefillStrategy }: AgentDeployModalProps) => {
  const { deployAgent, confirmAgentFunding, activateTrading } = useAgents();
  const { connected, fullWalletAddress, setShowModal, getProvider } = useWallet();

  // Form state
  const [mode, setMode] = useState<AgentMode>('trading');
  const [name, setName] = useState(prefillStrategy ? `${prefillStrategy.name} Agent` : '');
  const [strategyId, setStrategyId] = useState<StrategyId>(prefillStrategy?.id || 'momentum');
  const [budgetAmount, setBudgetAmount] = useState('1000');
  const [budgetCurrency, setBudgetCurrency] = useState<'MONTRA' | 'USDC'>(
    (prefillStrategy?.defaultConfig?.budgetCurrency as 'MONTRA' | 'USDC') || 'USDC'
  );
  const [maxDrawdownPct, setMaxDrawdownPct] = useState(prefillStrategy?.defaultConfig?.maxDrawdownPct || 15);
  const [maxPositionSizePct, setMaxPositionSizePct] = useState(prefillStrategy?.defaultConfig?.maxPositionSizePct || 25);
  const [maxTradeSize, setMaxTradeSize] = useState('500');
  const [maxDailyLoss, setMaxDailyLoss] = useState(10);
  const [mandate, setMandate] = useState(
    prefillStrategy ? `Execute ${prefillStrategy.name} strategy with strict risk management` : ''
  );
  const [exchangeKeyId, setExchangeKeyId] = useState<string | null>(null);

  // Wizard state
  const [step, setStep] = useState<WizardStep>('config');
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [error, setError] = useState('');
  const [fundingTxHash, setFundingTxHash] = useState('');
  const [funding, setFunding] = useState(false);
  const [activating, setActivating] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  // Derived state
  const isCexVenue = !!exchangeKeyId;
  const isMonitorMode = mode === 'monitor';
  const needsBudget = mode === 'trading' && !isCexVenue;
  const needsFunding = needsBudget; // Only CoW trading needs on-chain funding

  // Dynamic wizard steps
  const wizardSteps: WizardStep[] = needsFunding
    ? ['config', 'deploying', 'fund', 'success']
    : ['config', 'deploying', 'success'];

  const handleDeploy = async () => {
    setError('');
    if (!name.trim()) { setError('Agent name is required'); return; }
    if (!connected || !fullWalletAddress) { setError('Wallet not connected'); return; }

    // Budget validation only for CoW trading
    if (needsBudget && (!budgetAmount || parseFloat(budgetAmount) < 10)) {
      setError('Minimum budget is $10');
      return;
    }

    // Max trade size validation for CEX trading
    if (mode === 'trading' && isCexVenue && (!maxTradeSize || parseFloat(maxTradeSize) < 1)) {
      setError('Max trade size must be at least $1');
      return;
    }

    const config: AgentConfig = {
      name: name.trim(),
      strategyId,
      mode,
      maxDrawdownPct,
      maxPositionSizePct,
      mandate: mandate.trim(),
      exchangeKeyId: exchangeKeyId || null,
      // CoW trading: include budget
      ...(needsBudget ? {
        budgetAmount: parseFloat(budgetAmount),
        budgetCurrency,
      } : {}),
      // CEX trading: include trade size limits
      ...(mode === 'trading' && isCexVenue ? {
        maxTradeSize: parseFloat(maxTradeSize),
        maxDailyLoss,
      } : {}),
    };

    setStep('deploying');
    try {
      const result = await deployAgent(config, fullWalletAddress);
      setDeployResult(result);
      // Skip fund step for CEX and monitor modes
      if (!needsFunding) {
        setStep('success');
      } else {
        setStep('fund');
      }
    } catch {
      setError('Failed to deploy agent. Please try again.');
      setStep('config');
    }
  };

  const handleFundAgent = async () => {
    if (!deployResult || !fullWalletAddress) return;
    const provider = getProvider();
    if (!provider) { setError('No wallet provider'); return; }

    setFunding(true);
    setError('');
    try {
      const txHash = await transferUsdcToAgent(
        provider,
        deployResult.agentWalletAddress,
        parseFloat(budgetAmount),
      );
      setFundingTxHash(txHash);
      await confirmAgentFunding(deployResult.agent.id, txHash, parseFloat(budgetAmount));
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Funding transaction failed');
    } finally {
      setFunding(false);
    }
  };

  const handleActivateTrading = async () => {
    if (!deployResult) return;
    setActivating(true);
    setError('');
    try {
      await activateTrading(deployResult.agent.id);
      setTimeout(() => {
        resetForm();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to activate');
    } finally {
      setActivating(false);
    }
  };

  const handleCopyApiKey = () => {
    if (deployResult?.apiKey) {
      navigator.clipboard.writeText(deployResult.apiKey);
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 2000);
    }
  };

  const resetForm = () => {
    setMode('trading');
    setName('');
    setStrategyId('momentum');
    setBudgetAmount('1000');
    setBudgetCurrency('USDC');
    setMaxDrawdownPct(15);
    setMaxPositionSizePct(25);
    setMaxTradeSize('500');
    setMaxDailyLoss(10);
    setMandate('');
    setExchangeKeyId(null);
    setStep('config');
    setDeployResult(null);
    setError('');
    setFundingTxHash('');
    setFunding(false);
    setActivating(false);
    setApiKeyCopied(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-mono">
            <Bot size={16} className="text-primary" />
            {step === 'config' && 'Deploy New Agent'}
            {step === 'deploying' && 'Deploying Agent'}
            {step === 'fund' && 'Fund Agent'}
            {step === 'success' && 'Agent Ready'}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-2">
          {wizardSteps.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${
                step === s ? 'bg-primary'
                : i < wizardSteps.indexOf(step) ? 'bg-primary/50'
                : 'bg-border'
              }`} />
              {i < wizardSteps.length - 1 && (
                <div className={`w-6 h-px ${
                  i < wizardSteps.indexOf(step) ? 'bg-primary/50' : 'bg-border'
                }`} />
              )}
            </div>
          ))}
          <span className="text-[9px] font-mono text-muted-foreground ml-2">
            Step {wizardSteps.indexOf(step) + 1}/{wizardSteps.length}
          </span>
        </div>

        {/* Step 4: Success */}
        {step === 'success' && deployResult && (
          <div className="space-y-4">
            <div className="py-4 text-center">
              <CheckCircle size={32} className="text-primary mx-auto mb-3" />
              <p className="text-sm font-mono text-primary font-bold">
                {isMonitorMode ? 'Monitor Agent Deployed'
                  : isCexVenue ? 'Agent Deployed'
                  : 'Agent Deployed & Funded'}
              </p>
              {isMonitorMode && (
                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                  AI analysis will run every 5 minutes. Updates sent via XMTP.
                </p>
              )}
            </div>

            {/* API Key — shown once */}
            <div className="bg-secondary/50 border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">API Key</span>
                <span className="text-[9px] font-mono text-destructive font-bold">SAVE THIS — SHOWN ONCE</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-foreground bg-background/50 rounded px-2 py-1.5 break-all">
                  {deployResult.apiKey}
                </code>
                <button
                  onClick={handleCopyApiKey}
                  className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground border border-border rounded px-2 py-1.5 hover:text-primary hover:border-primary/30 transition"
                >
                  <Copy size={10} />
                  {apiKeyCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Funding tx link — CoW trading only */}
            {fundingTxHash && !isCexVenue && !isMonitorMode && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                <span>Funding TX:</span>
                <a
                  href={`https://basescan.org/tx/${fundingTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {fundingTxHash.slice(0, 10)}...{fundingTxHash.slice(-6)}
                  <ExternalLink size={8} />
                </a>
              </div>
            )}

            {/* ETH Gas Fee Notice — CoW trading only */}
            {!isCexVenue && !isMonitorMode && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] font-mono text-yellow-500 font-bold">IMPORTANT: Send ETH on Base Network for Gas Fees</p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  Your agent needs a small amount of ETH on <strong className="text-blue-400">Base network</strong> to pay for transaction gas fees (trading, withdrawals). Make sure your wallet is on <strong className="text-blue-400">Base</strong>, then send ~0.001 ETH to:
                </p>
                <div className="flex items-center gap-1.5">
                  <a
                    href={`https://basescan.org/address/${deployResult.agentWalletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[8px] font-mono font-bold text-blue-400 bg-blue-500/10 rounded px-1.5 py-0.5 shrink-0 hover:bg-blue-500/20 transition flex items-center gap-0.5"
                  >
                    BASE <ExternalLink size={7} />
                  </a>
                  <code className="text-[10px] font-mono text-foreground bg-background/50 rounded px-2 py-1.5 break-all select-all">
                    {deployResult.agentWalletAddress}
                  </code>
                </div>
              </div>
            )}

            {/* CEX Trading info */}
            {isCexVenue && !isMonitorMode && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] font-mono text-blue-400 font-bold">CEX Trading Mode</p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  Trades will execute through your exchange API key. Max trade size: ${maxTradeSize}.
                  Max drawdown: {maxDrawdownPct}%. No on-chain funding required.
                </p>
              </div>
            )}

            {/* Monitor Mode info */}
            {isMonitorMode && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] font-mono text-purple-400 font-bold">Monitor Mode</p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  This agent will analyze markets every ~5 minutes and send you XMTP alerts with AI
                  trade recommendations. No trades will be executed. AI consultations are free for monitor agents.
                </p>
              </div>
            )}

            {error && <p className="text-[10px] font-mono text-destructive">{error}</p>}

            <button
              onClick={handleActivateTrading}
              disabled={activating}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-3 py-2.5 hover:bg-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMonitorMode ? <Eye size={14} /> : <Zap size={14} />}
              {activating
                ? 'ACTIVATING...'
                : isMonitorMode ? 'START MONITORING' : 'START TRADING'}
            </button>
          </div>
        )}

        {/* Step 3: Fund Agent — only for CoW trading */}
        {step === 'fund' && deployResult && (
          <div className="space-y-4">
            <div className="text-[10px] font-mono text-muted-foreground space-y-2">
              <div className="flex justify-between">
                <span>Agent</span>
                <span className="text-foreground">{name}</span>
              </div>
              <div className="flex justify-between">
                <span>Agent Wallet</span>
                <span className="text-foreground font-mono">
                  {deployResult.agentWalletAddress.slice(0, 10)}...{deployResult.agentWalletAddress.slice(-6)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Budget to Send</span>
                <span className="text-foreground">{budgetAmount} USDC</span>
              </div>
            </div>

            <p className="text-[10px] font-mono text-muted-foreground/70">
              Send USDC on Base chain to your agent's wallet. This is a real on-chain transfer.
            </p>

            {fundingTxHash && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-primary">
                <CheckCircle size={12} />
                <span>TX sent:</span>
                <a
                  href={`https://basescan.org/tx/${fundingTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1"
                >
                  {fundingTxHash.slice(0, 10)}...{fundingTxHash.slice(-6)}
                  <ExternalLink size={8} />
                </a>
              </div>
            )}

            {error && <p className="text-[10px] font-mono text-destructive">{error}</p>}

            <button
              onClick={handleFundAgent}
              disabled={funding || !!fundingTxHash}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-3 py-2.5 hover:bg-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wallet size={14} />
              {funding ? 'CONFIRMING IN WALLET...' : fundingTxHash ? 'CONFIRMING ON CHAIN...' : `SEND ${budgetAmount} USDC`}
            </button>
          </div>
        )}

        {/* Step 2: Deploying spinner */}
        {step === 'deploying' && (
          <div className="py-8 text-center">
            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-mono text-primary font-bold">Deploying Agent</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">
              Creating {name}, generating wallet & API key...
            </p>
          </div>
        )}

        {/* Step 1: Config form */}
        {step === 'config' && (
          <div className="space-y-5">
            {/* Agent Mode Selector */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">Agent Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('trading')}
                  className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg border transition ${
                    mode === 'trading'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <Zap size={14} className={mode === 'trading' ? 'text-primary' : 'text-muted-foreground'} />
                  <span className={`text-[10px] font-mono font-bold ${mode === 'trading' ? 'text-primary' : 'text-foreground'}`}>
                    ACTIVE TRADING
                  </span>
                  <span className="text-[8px] font-mono text-muted-foreground text-center">
                    AI analysis + trade execution
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('monitor'); }}
                  className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg border transition ${
                    mode === 'monitor'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <Eye size={14} className={mode === 'monitor' ? 'text-primary' : 'text-muted-foreground'} />
                  <span className={`text-[10px] font-mono font-bold ${mode === 'monitor' ? 'text-primary' : 'text-foreground'}`}>
                    MONITOR ONLY
                  </span>
                  <span className="text-[8px] font-mono text-muted-foreground text-center">
                    AI alerts only, no trades
                  </span>
                </button>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">Agent Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={isMonitorMode ? 'My Market Monitor' : 'My Trading Agent'}
                maxLength={32}
                className="w-full bg-transparent text-sm font-mono text-foreground outline-none border-b border-border focus:border-primary py-1.5 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Strategy */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">Strategy</label>
              <select
                value={strategyId}
                onChange={e => setStrategyId(e.target.value as StrategyId)}
                className="w-full bg-card text-sm font-mono text-foreground outline-none border border-border rounded-lg px-3 py-2 focus:border-primary"
              >
                {MOCK_STRATEGIES.map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {s.riskLevel.toUpperCase()} RISK</option>
                ))}
              </select>
            </div>

            {/* Trading Venue / Exchange Connection */}
            <div>
              <ExchangeKeySelect
                value={exchangeKeyId}
                onChange={setExchangeKeyId}
                label={isMonitorMode ? 'Connect Exchange (read-only monitoring)' : undefined}
                hideOnChain={isMonitorMode}
              />
            </div>

            {/* Budget — only for CoW Protocol trading (no CEX key) */}
            {needsBudget && (
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">Budget</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={budgetAmount}
                    onChange={e => setBudgetAmount(e.target.value)}
                    placeholder="1000"
                    min="10"
                    max="1000000"
                    className="flex-1 bg-transparent text-sm font-mono text-foreground outline-none border-b border-border focus:border-primary py-1.5 placeholder:text-muted-foreground/50"
                  />
                  <div className="flex border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setBudgetCurrency('USDC')}
                      className={`text-[10px] font-mono px-3 py-1.5 transition ${budgetCurrency === 'USDC' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      USDC
                    </button>
                    <button
                      onClick={() => setBudgetCurrency('MONTRA')}
                      className={`text-[10px] font-mono px-3 py-1.5 transition ${budgetCurrency === 'MONTRA' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      MONTRA
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CEX Risk Parameters — Max Trade Size + Max Daily Loss */}
            {mode === 'trading' && isCexVenue && (
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-3">CEX Risk Limits</label>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1.5">
                      <span>Max Trade Size (per trade)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={maxTradeSize}
                        onChange={e => setMaxTradeSize(e.target.value)}
                        placeholder="500"
                        min="1"
                        max="100000"
                        className="flex-1 bg-transparent text-sm font-mono text-foreground outline-none border-b border-border focus:border-primary py-1.5 placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1.5">
                      <span>Max Daily Loss</span>
                      <span className="text-foreground font-bold">{maxDailyLoss}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={maxDailyLoss}
                      onChange={e => setMaxDailyLoss(parseInt(e.target.value))}
                      className="w-full accent-primary h-1.5"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Risk Parameters — trading agents only */}
            {!isMonitorMode && (
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-3">Risk Parameters</label>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1.5">
                      <span>Max Drawdown</span>
                      <span className="text-foreground font-bold">{maxDrawdownPct}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={maxDrawdownPct}
                      onChange={e => setMaxDrawdownPct(parseInt(e.target.value))}
                      className="w-full accent-primary h-1.5"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1.5">
                      <span>Max Position Size</span>
                      <span className="text-foreground font-bold">{maxPositionSizePct}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={maxPositionSizePct}
                      onChange={e => setMaxPositionSizePct(parseInt(e.target.value))}
                      className="w-full accent-primary h-1.5"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Mandate */}
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Mandate</label>
                <span className="text-[10px] font-mono text-muted-foreground/50">{mandate.length}/280</span>
              </div>
              <textarea
                value={mandate}
                onChange={e => setMandate(e.target.value)}
                placeholder={isMonitorMode
                  ? 'e.g., Monitor ETH/USDC and alert me on momentum shifts'
                  : 'e.g., Trade ETH/USDC momentum with strict risk management'}
                maxLength={280}
                rows={2}
                className="w-full bg-transparent text-xs font-mono text-foreground outline-none border border-border rounded-lg p-2 focus:border-primary placeholder:text-muted-foreground/50 resize-none"
              />
            </div>

            {error && (
              <p className="text-[10px] font-mono text-destructive">{error}</p>
            )}

            {/* Deploy Button or Connect Wallet */}
            {!connected ? (
              <button
                onClick={() => setShowModal(true)}
                className="w-full bg-secondary text-foreground text-xs font-mono font-bold rounded-lg px-3 py-2.5 hover:bg-secondary/80 transition"
              >
                CONNECT WALLET TO DEPLOY
              </button>
            ) : (
              <button
                onClick={handleDeploy}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-3 py-2.5 hover:bg-primary/80 transition"
              >
                <Rocket size={14} />
                {isMonitorMode ? 'DEPLOY MONITOR' : 'DEPLOY AGENT'}
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AgentDeployModal;
