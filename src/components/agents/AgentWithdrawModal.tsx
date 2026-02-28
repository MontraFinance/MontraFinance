import { useEffect, useState } from 'react';
import { ArrowUpRight, CheckCircle, Coins, DollarSign, ExternalLink, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Agent } from '@/types/agent';
import { useAgents } from '@/contexts/AgentContext';
import { useWallet } from '@/contexts/WalletContext';
import { getMontraBalance } from '@/lib/usdc';

type WithdrawToken = 'USDC' | 'MONTRA';

const TOKEN_CONFIG: Record<WithdrawToken, { label: string; icon: typeof DollarSign; color: string }> = {
  USDC: { label: 'USDC', icon: DollarSign, color: 'text-green-400' },
  MONTRA: { label: 'MONTRA', icon: Coins, color: 'text-primary' },
};

const AgentWithdrawModal = ({ open, onClose, agent }: { open: boolean; onClose: () => void; agent: Agent }) => {
  const { withdrawFromAgent } = useAgents();
  const { getProvider } = useWallet();
  const [selectedToken, setSelectedToken] = useState<WithdrawToken>('USDC');
  const [amount, setAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [agentMontraBalance, setAgentMontraBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const usdcMax = agent.wallet.remainingBudget;

  // Fetch agent MONTRA balance when modal opens
  useEffect(() => {
    if (!open) return;
    const agentAddr = agent.agentWalletAddress || agent.wallet.address;
    if (!agentAddr) return;

    setLoadingBalance(true);
    const provider = getProvider();
    if (!provider) {
      setLoadingBalance(false);
      return;
    }

    getMontraBalance(provider, agentAddr)
      .then(bal => setAgentMontraBalance(bal))
      .catch(() => setAgentMontraBalance(null))
      .finally(() => setLoadingBalance(false));
  }, [open, agent.agentWalletAddress, agent.wallet.address, getProvider]);

  const maxAmount = selectedToken === 'USDC' ? usdcMax : (agentMontraBalance ?? 0);

  const handleWithdraw = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;
    if (num > maxAmount) {
      const label = selectedToken === 'USDC'
        ? `$${maxAmount.toFixed(2)}`
        : `${maxAmount.toFixed(0)} MONTRA`;
      setError(`Maximum withdrawable: ${label}`);
      return;
    }

    setWithdrawing(true);
    setError('');

    try {
      const hash = await withdrawFromAgent(agent.id, num, selectedToken);
      setTxHash(hash);
      setDone(true);
      setTimeout(() => handleClose(), 5000);
    } catch (err: any) {
      setError(err.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleSetMax = () => {
    setAmount(selectedToken === 'USDC' ? maxAmount.toFixed(2) : maxAmount.toFixed(0));
  };

  const handleClose = () => {
    setAmount('');
    setSelectedToken('USDC');
    setWithdrawing(false);
    setTxHash('');
    setError('');
    setDone(false);
    onClose();
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) handleClose();
  };

  const handleTokenSwitch = (token: WithdrawToken) => {
    setSelectedToken(token);
    setAmount('');
    setError('');
  };

  const cfg = TOKEN_CONFIG[selectedToken];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-mono">
            <ArrowUpRight size={16} className="text-primary" />
            Withdraw from Agent
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-8 text-center">
            <CheckCircle size={32} className="text-primary mx-auto mb-3" />
            <p className="text-sm font-mono text-primary font-bold">Withdrawal Sent</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">
              {selectedToken === 'USDC'
                ? `$${parseFloat(amount).toFixed(2)} USDC`
                : `${parseFloat(amount).toFixed(0)} MONTRA`}{' '}
              sent to your wallet
            </p>
            {txHash && (
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-primary hover:underline flex items-center justify-center gap-1 mt-2"
              >
                View on BaseScan <ExternalLink size={8} />
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Token selector */}
            <div className="flex gap-2">
              {(Object.keys(TOKEN_CONFIG) as WithdrawToken[]).map(token => {
                const tc = TOKEN_CONFIG[token];
                const Icon = tc.icon;
                const isActive = selectedToken === token;
                return (
                  <button
                    key={token}
                    onClick={() => handleTokenSwitch(token)}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border text-[11px] font-mono font-bold py-2 transition ${
                      isActive
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                    }`}
                  >
                    <Icon size={12} className={isActive ? tc.color : ''} />
                    {tc.label}
                  </button>
                );
              })}
            </div>

            <div className="text-[10px] font-mono text-muted-foreground space-y-2">
              <div className="flex justify-between">
                <span>Agent</span>
                <span className="text-foreground">{agent.config.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Available {selectedToken}</span>
                <span className="text-foreground">
                  {selectedToken === 'USDC' ? (
                    `$${usdcMax.toFixed(2)} USDC`
                  ) : loadingBalance ? (
                    'Loading...'
                  ) : agentMontraBalance !== null ? (
                    `${agentMontraBalance.toFixed(0)} MONTRA`
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Agent Wallet</span>
                <span className="text-foreground">
                  {(agent.agentWalletAddress || agent.wallet.address).slice(0, 10)}...{(agent.agentWalletAddress || agent.wallet.address).slice(-4)}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-mono text-muted-foreground">Amount ({selectedToken})</label>
                <button
                  onClick={handleSetMax}
                  className="text-[9px] font-mono text-primary hover:underline"
                >
                  MAX
                </button>
              </div>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={selectedToken === 'USDC' ? '0.00' : '500'}
                min={selectedToken === 'USDC' ? '0.01' : '1'}
                max={maxAmount}
                step={selectedToken === 'USDC' ? '0.01' : '1'}
                className="w-full bg-transparent text-sm font-mono text-foreground outline-none border-b border-border focus:border-primary py-1.5 placeholder:text-muted-foreground/50"
              />
            </div>

            <p className="text-[10px] font-mono text-muted-foreground/70">
              {selectedToken === 'USDC'
                ? "USDC will be sent from the agent's wallet to your connected wallet on Base."
                : "MONTRA tokens will be sent from the agent's wallet to your connected wallet on Base."}
            </p>

            {error && (
              <p className="text-[10px] font-mono text-destructive">{error}</p>
            )}

            <button
              onClick={handleWithdraw}
              disabled={!amount || parseFloat(amount) <= 0 || withdrawing}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-3 py-2.5 hover:bg-primary/80 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {withdrawing ? (
                <><Loader2 size={14} className="animate-spin" /> WITHDRAWING...</>
              ) : (
                <><ArrowUpRight size={14} /> WITHDRAW {selectedToken}</>
              )}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AgentWithdrawModal;
