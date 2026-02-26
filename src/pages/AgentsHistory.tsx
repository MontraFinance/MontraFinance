import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bot, History, RefreshCw, Plus, Send, X, Clock } from 'lucide-react';
import LaunchCountdown from '@/components/LaunchCountdown';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import TierBadge from '@/components/TierBadge';
import { useWallet } from '@/contexts/WalletContext';
import { useAgents } from '@/contexts/AgentContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppSidebar } from '@/components/AppSidebar';
import { Skeleton } from '@/components/ui/skeleton';

/* ─── Types ─── */
interface CowOrder {
  id: string;
  orderUid: string;
  agentId: string;
  agentName: string;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmountMin: string;
  buyAmountActual: string | null;
  status: string;
  savingsUsd: number | null;
  createdAt: string;
  filledAt: string | null;
  expiresAt: string | null;
}

interface QueuedTrade {
  id: string;
  agent_id: string;
  sell_token: string;
  buy_token: string;
  sell_amount: string;
  recurring: boolean;
  interval_secs: number | null;
  status: string; // queued | awaiting_signature
  quote_buy_amount: string | null;
  quote_fee_amount: string | null;
  quote_valid_to: number | null;
  quote_data: Record<string, any> | null;
  created_at: string;
}

/* ─── Common Base tokens ─── */
const BASE_TOKENS = [
  { symbol: 'WETH',  address: '0x4200000000000000000000000000000000000006', decimals: 18 },
  { symbol: 'USDC',  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  { symbol: 'USDbC', address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6 },
  { symbol: 'DAI',   address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18 },
  { symbol: 'cbETH', address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', decimals: 18 },
] as const;

function toWei(amount: string, tokenAddress: string): string {
  const token = BASE_TOKENS.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
  const decimals = token?.decimals ?? 18;
  const parts = amount.split('.');
  const whole = parts[0] || '0';
  const frac = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + frac).toString();
}

const STATUS_COLORS: Record<string, string> = {
  filled: 'bg-green-500/20 text-green-400 border-green-500/30',
  open: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  expired: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

/* ─── CoW Protocol constants on Base ─── */
const COW_VAULT_RELAYER = '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110';
const COW_DOMAIN = {
  name: 'Gnosis Protocol',
  version: 'v2',
  chainId: 8453,
  verifyingContract: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41', // CoW settlement
};
const ERC20_APPROVE_ABI = '0x095ea7b3'; // approve(address,uint256)
const COW_ORDER_TYPES = {
  Order: [
    { name: 'sellToken', type: 'address' },
    { name: 'buyToken', type: 'address' },
    { name: 'receiver', type: 'address' },
    { name: 'sellAmount', type: 'uint256' },
    { name: 'buyAmount', type: 'uint256' },
    { name: 'validTo', type: 'uint32' },
    { name: 'appData', type: 'bytes32' },
    { name: 'feeAmount', type: 'uint256' },
    { name: 'kind', type: 'string' },
    { name: 'partiallyFillable', type: 'bool' },
    { name: 'sellTokenBalance', type: 'string' },
    { name: 'buyTokenBalance', type: 'string' },
  ],
};
const APP_DATA = '0x0000000000000000000000000000000000000000000000000000000000000000';

function truncateToken(addr: string) {
  const match = BASE_TOKENS.find(t => t.address.toLowerCase() === addr.toLowerCase());
  if (match) return match.symbol;
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatAmount(amount: string | null) {
  if (!amount) return '—';
  const n = Number(amount);
  if (isNaN(n)) return amount;
  if (n > 1e18) return (n / 1e18).toFixed(4);
  if (n > 1e6) return (n / 1e6).toFixed(2);
  return n.toLocaleString();
}

/* ─── Component ─── */
const AgentsHistory = () => {
  const { connected, fullWalletAddress, getProvider } = useWallet();
  const { agents } = useAgents();
  const [orders, setOrders] = useState<CowOrder[]>([]);
  const [queue, setQueue] = useState<QueuedTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [signing, setSigning] = useState<string | null>(null);
  const [signError, setSignError] = useState('');

  /* ── Fetch orders + queue ── */
  const fetchData = useCallback(async () => {
    if (!fullWalletAddress) return;
    setLoading(true);
    try {
      const [ordersRes, queueRes] = await Promise.all([
        fetch(`/api/trades/cow-orders?wallet=${encodeURIComponent(fullWalletAddress)}`),
        fetch(`/api/trades/cow-queue?wallet=${encodeURIComponent(fullWalletAddress)}`),
      ]);
      const ordersData = await ordersRes.json();
      const queueData = await queueRes.json();
      if (ordersData.orders) setOrders(ordersData.orders);
      if (queueData.queue) setQueue(queueData.queue);
    } catch (err) {
      console.warn('Failed to fetch orders/queue:', err);
    } finally {
      setLoading(false);
    }
  }, [fullWalletAddress]);

  useEffect(() => {
    if (!connected || !fullWalletAddress) return;
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [connected, fullWalletAddress, fetchData]);

  /* ── Sign & submit an awaiting_signature trade ── */
  const handleSign = async (item: QueuedTrade) => {
    if (!item.quote_data || !fullWalletAddress) return;
    setSigning(item.id);
    setSignError('');

    const provider = getProvider();
    if (!provider) {
      setSignError('Wallet provider not available');
      setSigning(null);
      return;
    }

    try {
      // 1. Approve VaultRelayer to spend sell token (max uint256)
      const maxUint256 = '0x' + 'f'.repeat(64);
      const approveData = ERC20_APPROVE_ABI +
        COW_VAULT_RELAYER.slice(2).padStart(64, '0') +
        maxUint256.slice(2);

      await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: fullWalletAddress,
          to: item.quote_data.sellToken,
          data: approveData,
        }],
      });

      // 2. Build EIP-712 order message
      const orderMessage = {
        sellToken: item.quote_data.sellToken,
        buyToken: item.quote_data.buyToken,
        receiver: item.quote_data.receiver,
        sellAmount: item.quote_data.sellAmount,
        buyAmount: item.quote_data.buyAmount,
        validTo: item.quote_data.validTo,
        appData: APP_DATA,
        feeAmount: '0',
        kind: item.quote_data.kind || 'sell',
        partiallyFillable: false,
        sellTokenBalance: 'erc20',
        buyTokenBalance: 'erc20',
      };

      // Request EIP-712 signature from wallet
      const signature = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [
          fullWalletAddress,
          JSON.stringify({
            types: { EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              { name: 'verifyingContract', type: 'address' },
            ], ...COW_ORDER_TYPES },
            primaryType: 'Order',
            domain: COW_DOMAIN,
            message: orderMessage,
          }),
        ],
      });

      // Submit the signed order via our backend
      const swapRes = await fetch('/api/trades/cow-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: item.agent_id,
          sellToken: item.sell_token,
          buyToken: item.buy_token,
          sellAmount: String(item.sell_amount),
          signature,
          quoteData: item.quote_data,
        }),
      });

      if (!swapRes.ok) {
        const err = await swapRes.json();
        throw new Error(err.error || 'Swap submission failed');
      }

      // Mark queue item as done (or re-queue if recurring)
      await fetch('/api/trades/cow-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId: item.id, wallet: fullWalletAddress }),
      });

      // Refresh data
      await fetchData();
    } catch (err: any) {
      if (err.code === 4001) {
        setSignError('Signature rejected by user');
      } else {
        setSignError(err.message || 'Signing failed');
      }
    } finally {
      setSigning(null);
    }
  };

  /* ── Cancel a queued trade ── */
  const handleCancel = async (queueId: string) => {
    if (!fullWalletAddress) return;
    await fetch('/api/trades/cow-queue', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId, wallet: fullWalletAddress }),
    });
    await fetchData();
  };

  const filledOrders = orders.filter(o => o.status === 'filled');
  const pendingOrders = orders.filter(o => o.status === 'open' || o.status === 'pending');
  const totalSavings = orders.reduce((sum, o) => sum + (o.savingsUsd || 0), 0);
  const awaitingSignature = queue.filter(q => q.status === 'awaiting_signature');
  const queuedTrades = queue.filter(q => q.status === 'queued');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LaunchCountdown title="Agent Orders" />
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-mono font-bold tracking-wider">AGENT ORDERS</h1>
          <span className="text-xs font-mono text-primary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            COW PROTOCOL
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
            {new Date().toLocaleString()}
          </span>
          <TierBadge />
          <ConnectWalletButton />
        </div>
      </header>

      <div className="flex">
        <AppSidebar activePage="agents-history" />

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6">
          {!connected ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <History size={40} className="text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-sm font-mono font-bold text-foreground mb-2">WALLET REQUIRED</h2>
              <p className="text-[10px] font-mono text-muted-foreground mb-6">
                Connect your wallet to view agent trade history.
              </p>
              <ConnectWalletButton />
            </div>
          ) : loading && orders.length === 0 && queue.length === 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
              </div>
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : (
            <>
              {/* Action bar */}
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setShowQueueModal(true)}
                  className="flex items-center gap-1.5 text-xs font-mono text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition"
                >
                  <Plus size={12} /> Queue Trade
                </button>
                {awaitingSignature.length > 0 && (
                  <span className="text-xs font-mono text-yellow-400 flex items-center gap-1">
                    <Clock size={12} />
                    {awaitingSignature.length} order{awaitingSignature.length > 1 ? 's' : ''} awaiting signature
                  </span>
                )}
              </div>

              {/* ── Awaiting Signature Section ── */}
              {awaitingSignature.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest font-mono">
                      Sign & Submit
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="space-y-2">
                    {awaitingSignature.map(item => {
                      const agentName = agents.find(a => a.id === item.agent_id)?.config.name || 'Agent';
                      return (
                        <div key={item.id} className="bg-card border border-yellow-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-foreground font-bold">{agentName}</p>
                            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                              Sell {formatAmount(String(item.sell_amount))} {truncateToken(item.sell_token)}
                              {' → '}
                              Buy ~{formatAmount(item.quote_buy_amount)} {truncateToken(item.buy_token)}
                              {item.quote_fee_amount && ` (fee: ${formatAmount(item.quote_fee_amount)})`}
                            </p>
                            {item.quote_valid_to && (
                              <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                                Quote expires: {new Date(item.quote_valid_to * 1000).toLocaleTimeString()}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCancel(item.id)}
                              className="text-[10px] font-mono text-muted-foreground border border-border rounded-lg px-2 py-1 hover:text-foreground hover:bg-secondary transition"
                            >
                              <X size={10} />
                            </button>
                            <button
                              onClick={() => handleSign(item)}
                              disabled={signing === item.id}
                              className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-primary-foreground bg-primary rounded-lg px-3 py-1.5 hover:bg-primary/80 transition disabled:opacity-50"
                            >
                              {signing === item.id ? (
                                <RefreshCw size={10} className="animate-spin" />
                              ) : (
                                <Send size={10} />
                              )}
                              {signing === item.id ? 'SIGNING...' : 'SIGN & SUBMIT'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {signError && (
                      <p className="text-[10px] font-mono text-destructive mt-1">{signError}</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Queued Trades (waiting for cron to get quote) ── */}
              {queuedTrades.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                      Queued — Waiting for Quote
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="space-y-2">
                    {queuedTrades.map(item => {
                      const agentName = agents.find(a => a.id === item.agent_id)?.config.name || 'Agent';
                      return (
                        <div key={item.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-mono text-foreground font-bold">{agentName}</p>
                            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                              Sell {formatAmount(String(item.sell_amount))} {truncateToken(item.sell_token)} → {truncateToken(item.buy_token)}
                              {item.recurring && ` (recurring every ${Math.round((item.interval_secs || 0) / 3600)}h)`}
                            </p>
                          </div>
                          <button
                            onClick={() => handleCancel(item.id)}
                            className="text-[10px] font-mono text-muted-foreground border border-border rounded-lg px-2 py-1.5 hover:text-foreground hover:bg-secondary transition"
                          >
                            Cancel
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Summary stats ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-card border border-border rounded-2xl p-4">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Total Orders</p>
                  <p className="text-2xl font-mono font-bold">{orders.length}</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Filled</p>
                  <p className="text-2xl font-mono font-bold text-green-400">{filledOrders.length}</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Pending</p>
                  <p className="text-2xl font-mono font-bold text-yellow-400">{pendingOrders.length}</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">MEV Savings</p>
                  <p className="text-2xl font-mono font-bold text-primary">${totalSavings.toFixed(2)}</p>
                </div>
              </div>

              {/* ── Orders table ── */}
              {orders.length > 0 ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                      Order History
                    </span>
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {orders.length} orders
                    </span>
                  </div>
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr className="border-b border-border text-[10px] text-muted-foreground uppercase">
                            <th className="text-left px-4 py-3">Agent</th>
                            <th className="text-left px-4 py-3">Sell</th>
                            <th className="text-left px-4 py-3">Buy</th>
                            <th className="text-right px-4 py-3">Sell Amt</th>
                            <th className="text-right px-4 py-3">Buy Amt</th>
                            <th className="text-center px-4 py-3">Status</th>
                            <th className="text-right px-4 py-3">Savings</th>
                            <th className="text-right px-4 py-3">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((order) => (
                            <tr key={order.id} className="border-b border-border/50 hover:bg-secondary/30 transition">
                              <td className="px-4 py-3 text-foreground">{order.agentName}</td>
                              <td className="px-4 py-3 text-muted-foreground">{truncateToken(order.sellToken)}</td>
                              <td className="px-4 py-3 text-muted-foreground">{truncateToken(order.buyToken)}</td>
                              <td className="px-4 py-3 text-right text-foreground">{formatAmount(order.sellAmount)}</td>
                              <td className="px-4 py-3 text-right text-foreground">
                                {formatAmount(order.buyAmountActual || order.buyAmountMin)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || 'bg-secondary text-muted-foreground border-border'}`}>
                                  {order.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-primary">
                                {order.savingsUsd ? `$${order.savingsUsd.toFixed(2)}` : '—'}
                              </td>
                              <td className="px-4 py-3 text-right text-muted-foreground">
                                {new Date(order.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : orders.length === 0 && queue.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-12 text-center">
                  <History size={40} className="text-muted-foreground/30 mx-auto mb-4" />
                  <h2 className="text-sm font-mono font-bold text-foreground mb-2">NO ORDERS YET</h2>
                  <p className="text-[10px] font-mono text-muted-foreground mb-6">
                    Queue a trade for your agent to get started with MEV-protected CoW Protocol swaps.
                  </p>
                  <button
                    onClick={() => setShowQueueModal(true)}
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2.5 hover:bg-primary/80 transition"
                  >
                    <Plus size={14} /> QUEUE YOUR FIRST TRADE
                  </button>
                </div>
              ) : null}
            </>
          )}
        </main>
      </div>

      {/* ── Queue Trade Modal ── */}
      <QueueTradeModal
        open={showQueueModal}
        onClose={() => setShowQueueModal(false)}
        agents={agents}
        wallet={fullWalletAddress || ''}
        onQueued={fetchData}
      />
    </div>
  );
};

/* ─── Queue Trade Modal ─── */
interface QueueTradeModalProps {
  open: boolean;
  onClose: () => void;
  agents: { id: string; config: { name: string } }[];
  wallet: string;
  onQueued: () => void;
}

const QueueTradeModal = ({ open, onClose, agents, wallet, onQueued }: QueueTradeModalProps) => {
  const [agentId, setAgentId] = useState('');
  const [sellToken, setSellToken] = useState(BASE_TOKENS[0].address);
  const [buyToken, setBuyToken] = useState(BASE_TOKENS[1].address);
  const [sellAmount, setSellAmount] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [intervalHours, setIntervalHours] = useState('24');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && agents.length > 0 && !agentId) setAgentId(agents[0].id);
  }, [open, agents, agentId]);

  const handleSubmit = async () => {
    setError('');
    if (!agentId) { setError('Select an agent'); return; }
    if (!sellAmount || Number(sellAmount) <= 0) { setError('Enter a sell amount'); return; }
    if (sellToken === buyToken) { setError('Sell and buy tokens must be different'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/trades/cow-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          sellToken,
          buyToken,
          sellAmount: toWei(sellAmount, sellToken),
          wallet,
          recurring,
          intervalSecs: recurring ? Number(intervalHours) * 3600 : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to queue');
      }
      onQueued();
      onClose();
      setSellAmount('');
      setRecurring(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-mono">
            <Plus size={16} className="text-primary" />
            Queue CoW Protocol Trade
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Agent */}
          <div>
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">Agent</label>
            <select
              value={agentId}
              onChange={e => setAgentId(e.target.value)}
              className="w-full bg-card text-sm font-mono text-black outline-none border border-border rounded-lg px-3 py-2 focus:border-primary"
            >
              {agents.length === 0 && <option value="">No agents deployed</option>}
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.config.name || a.id.slice(0, 8)}</option>
              ))}
            </select>
            {agents.length === 0 && (
              <p className="text-[10px] font-mono text-muted-foreground mt-1.5">
                You need to <Link to="/agents" className="text-primary underline" onClick={onClose}>deploy an agent</Link> first.
              </p>
            )}
          </div>

          {/* Sell token */}
          <div>
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">Sell Token</label>
            <select
              value={sellToken}
              onChange={e => setSellToken(e.target.value)}
              className="w-full bg-card text-sm font-mono text-foreground outline-none border border-border rounded-lg px-3 py-2 focus:border-primary"
            >
              {BASE_TOKENS.map(t => (
                <option key={t.address} value={t.address}>{t.symbol}</option>
              ))}
            </select>
          </div>

          {/* Buy token */}
          <div>
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">Buy Token</label>
            <select
              value={buyToken}
              onChange={e => setBuyToken(e.target.value)}
              className="w-full bg-card text-sm font-mono text-foreground outline-none border border-border rounded-lg px-3 py-2 focus:border-primary"
            >
              {BASE_TOKENS.map(t => (
                <option key={t.address} value={t.address}>{t.symbol}</option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">
              Sell Amount ({BASE_TOKENS.find(t => t.address === sellToken)?.symbol || 'tokens'})
            </label>
            <input
              type="text"
              value={sellAmount}
              onChange={e => setSellAmount(e.target.value)}
              placeholder="e.g. 0.01 or 500"
              className="w-full bg-transparent text-sm font-mono text-foreground outline-none border-b border-border focus:border-primary py-1.5 placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={recurring}
                onChange={e => setRecurring(e.target.checked)}
                className="accent-primary"
              />
              <span className="text-[10px] font-mono text-muted-foreground uppercase">Recurring</span>
            </label>
            {recurring && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-mono text-muted-foreground">every</span>
                <input
                  type="number"
                  value={intervalHours}
                  onChange={e => setIntervalHours(e.target.value)}
                  min="1"
                  max="720"
                  className="w-16 bg-transparent text-sm font-mono text-foreground outline-none border-b border-border focus:border-primary py-0.5 text-center"
                />
                <span className="text-[10px] font-mono text-muted-foreground">hours</span>
              </div>
            )}
          </div>

          {error && <p className="text-[10px] font-mono text-destructive">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting || agents.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-3 py-2.5 hover:bg-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
            {submitting ? 'QUEUING...' : 'QUEUE TRADE'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgentsHistory;
