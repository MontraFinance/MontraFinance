import { useState, useEffect } from 'react';
import { Wallet, CheckCircle, ExternalLink, Loader2, Fuel, Coins, DollarSign } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Agent } from '@/types/agent';
import { useAgents } from '@/contexts/AgentContext';
import { useWallet } from '@/contexts/WalletContext';
import {
  transferUsdcToAgent,
  getUsdcBalance,
  transferEthToAgent,
  getEthBalance,
  transferMontraToAgent,
  getMontraBalance,
} from '@/lib/usdc';

type FundToken = 'USDC' | 'ETH' | 'MONTRA';

const TOKEN_CONFIG: Record<FundToken, { label: string; icon: typeof DollarSign; color: string; description: string }> = {
  USDC: { label: 'USDC', icon: DollarSign, color: 'text-green-400', description: 'Trading budget' },
  ETH: { label: 'ETH', icon: Fuel, color: 'text-blue-400', description: 'Gas for transactions' },
  MONTRA: { label: 'MONTRA', icon: Coins, color: 'text-primary', description: 'AI consultation burns' },
};

const AgentFundModal = ({ open, onClose, agent }: { open: boolean; onClose: () => void; agent: Agent }) => {
  const { confirmAgentFunding } = useAgents();
  const { getProvider, fullWalletAddress } = useWallet();
  const [selectedToken, setSelectedToken] = useState<FundToken>('USDC');
  const [amount, setAmount] = useState('');
  const [funded, setFunded] = useState(false);
  const [funding, setFunding] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [userBalances, setUserBalances] = useState<Record<FundToken, number | null>>({ USDC: null, ETH: null, MONTRA: null });
  const [agentBalances, setAgentBalances] = useState<Record<string, number | null>>({ ETH: null, MONTRA: null });
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Fetch balances on mount
  useEffect(() => {
    if (!open || !fullWalletAddress) return;
    const provider = getProvider();
    if (!provider) return;

    const agentAddr = agent.agentWalletAddress || agent.wallet.address;

    setLoadingBalance(true);
    Promise.all([
      getUsdcBalance(provider, fullWalletAddress).catch(() => null),
      getEthBalance(provider, fullWalletAddress).catch(() => null),
      getMontraBalance(provider, fullWalletAddress).catch(() => null),
      getEthBalance(provider, agentAddr).catch(() => null),
      getMontraBalance(provider, agentAddr).catch(() => null),
    ]).then(([usdc, eth, montra, agentEth, agentMontra]) => {
      setUserBalances({ USDC: usdc, ETH: eth, MONTRA: montra });
      setAgentBalances({ ETH: agentEth, MONTRA: agentMontra });
    }).finally(() => setLoadingBalance(false));
  }, [open, fullWalletAddress, getProvider]);

  const handleFund = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;

    const provider = getProvider();
    if (!provider || !fullWalletAddress) {
      setError('Wallet not connected');
      return;
    }

    const agentAddr = agent.agentWalletAddress || agent.wallet.address;
    if (!agentAddr) {
      setError('Agent wallet address not found');
      return;
    }

    setFunding(true);
    setError('');

    try {
      let hash: string;

      if (selectedToken === 'USDC') {
        hash = await transferUsdcToAgent(provider, agentAddr, num);
        setTxHash(hash);
        // Confirm USDC funding on backend (updates budget tracking)
        await confirmAgentFunding(agent.id, hash, num);
      } else if (selectedToken === 'ETH') {
        hash = await transferEthToAgent(provider, agentAddr, num);
        setTxHash(hash);
      } else {
        hash = await transferMontraToAgent(provider, agentAddr, num);
        setTxHash(hash);
      }

      setFunded(true);
      setTimeout(() => handleClose(), 3000);
    } catch (err: any) {
      setError(err.message || 'Transfer failed');
    } finally {
      setFunding(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setFunded(false);
    setFunding(false);
    setTxHash('');
    setError('');
    setSelectedToken('USDC');
    onClose();
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) handleClose();
  };

  const currentBalance = userBalances[selectedToken];
  const tokenCfg = TOKEN_CONFIG[selectedToken];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-mono">
            <Wallet size={16} className="text-primary" />
            Fund Agent
          </DialogTitle>
        </DialogHeader>

        {funded ? (
          <div className="py-8 text-center">
            <CheckCircle size={32} className="text-primary mx-auto mb-3" />
            <p className="text-sm font-mono text-primary font-bold">Agent Funded</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">
              +{parseFloat(amount)} {selectedToken} sent on-chain
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
            {/* Token selector tabs */}
            <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
              {(Object.keys(TOKEN_CONFIG) as FundToken[]).map((token) => {
                const cfg = TOKEN_CONFIG[token];
                const Icon = cfg.icon;
                return (
                  <button
                    key={token}
                    onClick={() => { setSelectedToken(token); setAmount(''); setError(''); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold py-2 rounded-md transition ${
                      selectedToken === token
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon size={12} className={selectedToken === token ? cfg.color : ''} />
                    {cfg.label}
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
                <span>USDC Budget</span>
                <span className="text-foreground">${agent.wallet.remainingBudget.toFixed(2)}</span>
              </div>
              {agentBalances.ETH !== null && (
                <div className="flex justify-between">
                  <span>Agent ETH (gas)</span>
                  <span className={`text-foreground ${(agentBalances.ETH || 0) < 0.0005 ? 'text-destructive' : ''}`}>
                    {(agentBalances.ETH || 0).toFixed(6)} ETH
                    {(agentBalances.ETH || 0) < 0.0005 && ' ⚠️ low'}
                  </span>
                </div>
              )}
              {agentBalances.MONTRA !== null && (
                <div className="flex justify-between">
                  <span>Agent MONTRA (AI)</span>
                  <span className="text-foreground">
                    {(agentBalances.MONTRA || 0).toFixed(0)} MONTRA
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2">
                <span>Your {tokenCfg.label} Balance</span>
                <span className="text-foreground">
                  {loadingBalance ? (
                    <Loader2 size={10} className="animate-spin inline" />
                  ) : currentBalance !== null ? (
                    selectedToken === 'USDC' ? `$${currentBalance.toFixed(2)}` :
                    selectedToken === 'ETH' ? `${currentBalance.toFixed(6)} ETH` :
                    `${currentBalance.toFixed(0)} MONTRA`
                  ) : '—'}
                </span>
              </div>
            </div>

            {/* Purpose hint */}
            <div className="text-[9px] font-mono text-muted-foreground/60 bg-muted/20 rounded px-2 py-1.5">
              {selectedToken === 'USDC' && '💰 USDC is the trading budget — used to buy/sell tokens via CoW Protocol.'}
              {selectedToken === 'ETH' && '⛽ ETH pays for gas fees — approvals, burns, and on-chain transactions. ~0.001 ETH is usually enough.'}
              {selectedToken === 'MONTRA' && '🔥 MONTRA tokens are burned to consult the AI model about trading decisions. ~200 MONTRA per consultation.'}
            </div>

            <div>
              <label className="text-[10px] font-mono text-muted-foreground block mb-1.5">
                Amount ({tokenCfg.label})
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={selectedToken === 'ETH' ? '0.001' : selectedToken === 'MONTRA' ? '500' : '0.00'}
                min={selectedToken === 'ETH' ? '0.0001' : '1'}
                step={selectedToken === 'ETH' ? '0.0001' : '1'}
                className="w-full bg-transparent text-sm font-mono text-foreground outline-none border-b border-border focus:border-primary py-1.5 placeholder:text-muted-foreground/50"
              />
            </div>

            {error && (
              <p className="text-[10px] font-mono text-destructive">{error}</p>
            )}

            {txHash && !funded && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-primary">
                <Loader2 size={10} className="animate-spin" />
                <span>Confirming tx...</span>
                <a
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1"
                >
                  {txHash.slice(0, 10)}...
                  <ExternalLink size={8} />
                </a>
              </div>
            )}

            <button
              onClick={handleFund}
              disabled={!amount || parseFloat(amount) <= 0 || funding}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-3 py-2.5 hover:bg-primary/80 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {funding ? (
                <><Loader2 size={14} className="animate-spin" /> CONFIRMING IN WALLET...</>
              ) : (
                `SEND ${tokenCfg.label} TO AGENT`
              )}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AgentFundModal;
