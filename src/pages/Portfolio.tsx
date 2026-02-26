import { useState, useEffect } from 'react';
import { Wallet, RefreshCw, TrendingUp, Coins, Signal } from 'lucide-react';
import LaunchCountdown from '@/components/LaunchCountdown';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import TierBadge from '@/components/TierBadge';
import { useWallet } from '@/contexts/WalletContext';
import { AppSidebar } from '@/components/AppSidebar';
import { Skeleton } from '@/components/ui/skeleton';

interface Holding {
  symbol: string;
  name: string;
  address: string | null;
  balance: string;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
}

interface PortfolioData {
  success: boolean;
  wallet: string;
  chain: string;
  totalValueUsd: number;
  holdingsCount: number;
  holdings: Holding[];
}

const PIE_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#e11d48', '#ca8a04'];

function formatUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
}

function formatBalance(b: string): string {
  const n = parseFloat(b);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toExponential(2);
}

const Portfolio = () => {
  const { connected, fullWalletAddress } = useWallet();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = () => {
    if (!connected || !fullWalletAddress) return;
    setLoading(true);
    setError(null);
    fetch(`/api/portfolio?wallet=${encodeURIComponent(fullWalletAddress)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res);
        } else {
          setError(res.error || 'Failed to load portfolio');
        }
      })
      .catch(() => setError('Failed to load portfolio'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPortfolio();
  }, [connected, fullWalletAddress]);

  const pieData = data?.holdings.map((h, i) => ({
    name: h.symbol,
    value: h.valueUsd,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  })).filter((d) => d.value > 0) || [];

  const largestHolding = data?.holdings[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LaunchCountdown title="Portfolio" />
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-mono font-bold tracking-wider">PORTFOLIO</h1>
          <span className="text-xs font-mono text-primary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            BASE CHAIN
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
        <AppSidebar activePage="portfolio" />

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6">
          {!connected ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Wallet size={40} className="text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-sm font-mono font-bold text-foreground mb-2">WALLET REQUIRED</h2>
              <p className="text-[10px] font-mono text-muted-foreground mb-6">
                Connect your wallet to view your Base chain portfolio.
              </p>
              <ConnectWalletButton />
            </div>
          ) : loading ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-3 w-32 mb-2" />
                  <Skeleton className="h-10 w-48 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-9 w-24 rounded-lg" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Skeleton className="h-48 rounded-2xl" />
                <Skeleton className="h-48 rounded-2xl lg:col-span-2" />
              </div>
            </div>
          ) : error ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Wallet size={40} className="text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-sm font-mono font-bold text-foreground mb-2">ERROR</h2>
              <p className="text-[10px] font-mono text-muted-foreground mb-4">{error}</p>
              <button
                onClick={fetchPortfolio}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2.5 hover:bg-primary/80 transition"
              >
                <RefreshCw size={12} /> RETRY
              </button>
            </div>
          ) : !data || data.holdingsCount === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Coins size={40} className="text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-sm font-mono font-bold text-foreground mb-2">NO HOLDINGS</h2>
              <p className="text-[10px] font-mono text-muted-foreground mb-6">
                This wallet has no ETH or token balances on Base.
              </p>
              <button
                onClick={fetchPortfolio}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2.5 hover:bg-primary/80 transition"
              >
                <RefreshCw size={12} /> REFRESH
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Total Portfolio Value</p>
                  <p className="text-4xl font-mono font-bold text-foreground">{formatUsd(data.totalValueUsd)}</p>
                  <p className="text-xs font-mono text-muted-foreground mt-1">
                    {data.holdingsCount} asset{data.holdingsCount !== 1 ? 's' : ''} on Base
                  </p>
                </div>
                <button
                  onClick={fetchPortfolio}
                  disabled={loading}
                  className="flex items-center gap-2 text-xs font-mono text-muted-foreground border border-border rounded-lg px-3 py-2 hover:text-foreground hover:bg-secondary transition disabled:opacity-30"
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>

              {/* Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Largest Holding</span>
                    <TrendingUp size={12} className="text-primary" />
                  </div>
                  <p className="text-2xl font-mono font-bold">{largestHolding?.symbol || '—'}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">
                    {largestHolding ? formatUsd(largestHolding.valueUsd) : '—'}
                  </p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Assets</span>
                    <Coins size={12} className="text-primary" />
                  </div>
                  <p className="text-2xl font-mono font-bold">{data.holdingsCount}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">Unique tokens held</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Chain</span>
                    <Signal size={12} className="text-primary" />
                  </div>
                  <p className="text-2xl font-mono font-bold">Base</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">Chain ID 8453</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Wallet</span>
                    <Wallet size={12} className="text-primary" />
                  </div>
                  <p className="text-sm font-mono font-bold truncate">{fullWalletAddress}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">Connected</p>
                </div>
              </div>

              {/* Chart + Table */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Pie chart */}
                {pieData.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs font-mono font-bold uppercase mb-4">Allocation</p>
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width={160} height={160}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            strokeWidth={2}
                            stroke="hsl(var(--card))"
                          >
                            {pieData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {pieData.map((d) => (
                          <div key={d.name} className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                            <span className="text-xs font-mono text-muted-foreground">{d.name}</span>
                            <span className="text-xs font-mono font-bold text-foreground ml-auto">
                              {data.totalValueUsd > 0 ? `${Math.round((d.value / data.totalValueUsd) * 100)}%` : '0%'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Holdings table */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden lg:col-span-2">
                  <div className="px-4 pt-4 pb-2">
                    <p className="text-xs font-mono font-bold uppercase">Holdings</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-mono">
                      <thead>
                        <tr className="border-b border-border text-[10px] text-muted-foreground uppercase">
                          <th className="text-left px-4 py-2 font-medium">Asset</th>
                          <th className="text-right px-4 py-2 font-medium">Balance</th>
                          <th className="text-right px-4 py-2 font-medium">Price</th>
                          <th className="text-right px-4 py-2 font-medium">Value</th>
                          <th className="text-right px-4 py-2 font-medium">Weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.holdings.map((h, i) => (
                          <tr key={h.symbol + i} className="border-b border-border/50 hover:bg-secondary/30 transition">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                                />
                                <div>
                                  <p className="text-xs font-bold text-foreground">{h.symbol}</p>
                                  <p className="text-[10px] text-muted-foreground">{h.name}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-right text-foreground">
                              {formatBalance(h.balance)}
                            </td>
                            <td className="px-4 py-3 text-xs text-right text-muted-foreground">
                              {h.priceUsd > 0 ? `$${h.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: h.priceUsd < 1 ? 6 : 2 })}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-right font-bold text-primary">
                              {formatUsd(h.valueUsd)}
                            </td>
                            <td className="px-4 py-3 text-xs text-right text-muted-foreground">
                              {data.totalValueUsd > 0 ? `${Math.round((h.valueUsd / data.totalValueUsd) * 100)}%` : '0%'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Portfolio;
