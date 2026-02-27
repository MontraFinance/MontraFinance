import { useState } from 'react';
import { ArrowUpRight, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Agent } from '@/types/agent';
import { useAgents } from '@/contexts/AgentContext';

const AgentWithdrawModal = ({ open, onClose, agent }: { open: boolean; onClose: () => void; agent: Agent }) => {
  const { withdrawFromAgent } = useAgents();
  const [amount, setAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const maxAmount = agent.wallet.remainingBudget;

  const handleWithdraw = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;
    if (num > maxAmount) {
      setError(`Maximum withdrawable: $${maxAmount.toFixed(2)}`);
      return;
    }

    setWithdrawing(true);
    setError('');

    try {
      const hash = await withdrawFromAgent(agent.id, num);
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
    setAmount(maxAmount.toFixed(2));
  };

  const handleClose = () => {
    setAmount('');
    setWithdrawing(false);
    setTxHash('');
    setError('');
    setDone(false);
    onClose();
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) handleClose();
  };

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
              ${parseFloat(amount).toFixed(2)} USDC sent to your wallet
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
            <div className="text-[10px] font-mono text-muted-foreground space-y-2">
              <div className="flex justify-between">
                <span>Agent</span>
                <span className="text-foreground">{agent.config.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Available Balance</span>
                <span className="text-foreground">${maxAmount.toFixed(2)} USDC</span>
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
                <label className="text-[10px] font-mono text-muted-foreground">Amount (USDC)</label>
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
                placeholder="0.00"
                min="0.01"
                max={maxAmount}
                step="0.01"
                className="w-full bg-transparent text-sm font-mono text-foreground outline-none border-b border-border focus:border-primary py-1.5 placeholder:text-muted-foreground/50"
              />
            </div>

            <p className="text-[10px] font-mono text-muted-foreground/70">
              USDC will be sent from the agent's wallet to your connected wallet on Base.
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
                <><ArrowUpRight size={14} /> WITHDRAW USDC</>
              )}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AgentWithdrawModal;
