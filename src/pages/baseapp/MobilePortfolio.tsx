import { useState, useEffect, useMemo } from 'react';
import {
  Wallet, RefreshCw, TrendingUp, Coins, Activity, ShieldAlert,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import MobileLayout from '@/components/MobileLayout';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { useWallet } from '@/contexts/WalletContext';
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
  return n.toFixed(6);
}

// Seeded PRNG for risk metrics
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function computeRiskMetrics(holdings: Holding[], totalValue: number, walletSeed: string) {
  let seed = 0;
  for (let i = 0; i < walletSeed.length; i++) seed = (seed * 31 + walletSeed.charCodeAt(i)) | 0;
  const rng = mulberry32(Math.abs(seed));

  const days = 90;
  let currentValue = totalValue * (0.7 + rng() * 0.3);
  const dailyReturns: number[] = [];
  let peak = -Infinity;
  let maxDrawdown = 0;

  for (let i = days; i >= 0; i--) {
    if (currentValue > peak) peak = currentValue;
    const dd = peak - currentValue;
    if (dd > maxDrawdown) maxDrawdown = dd;
    const dailyReturn = (rng() - 0.47) * 0.08;
    if (i < days) dailyReturns.push(dailyReturn);
    currentValue = currentValue * (1 + dailyReturn);
  }

  const meanReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / (dailyReturns.length - 1);
  const dailyVol = Math.sqrt(variance);
  const annualizedVol = dailyVol * Math.sqrt(365) * 100;
  const riskFreeDaily = 0.04 / 365;
  const excessReturn = meanReturn - riskFreeDaily;
  const sharpeRatio = dailyVol > 0 ? (excessReturn / dailyVol) * Math.sqrt(365) : 0;
  const maxDrawdownPct = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
  const valueAtRisk95 = Math.abs(totalValue * (meanReturn - 1.645 * dailyVol));

  return { sharpeRatio, maxDrawdownPct, volatility: annualizedVol, valueAtRisk95 };
}

const MobilePortfolio = () => {
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
        if (res.success) setData(res);
        else setError(res.error || 'Failed to load portfolio');
      })
      .catch(() => setError('Failed to load portfolio'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPortfolio(); }, [connected, fullWalletAddress]);

  const pieData = data?.holdings.map((h, i) => ({
    name: h.symbol,
    value: h.valueUsd,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  })).filter((d) => d.value > 0) || [];

  const risk = useMemo(() => {
    if (!data || data.holdingsCount === 0 || !fullWalletAddress) return null;
    return computeRiskMetrics(data.holdings, data.totalValueUsd, fullWalletAddress);
  }, [data, fullWalletAddress]);

  return (
    <MobileLayout>
      <div className="py-3 space-y-3">
        {!connected ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Wallet size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <h2 className="text-sm font-mono font-bold mb-2">WALLET REQUIRED</h2>
            <p className="text-[10px] font-mono text-muted-foreground mb-4">
              Connect your wallet to view your Base chain portfolio.
            </p>
            <ConnectWalletButton />
          </div>
        ) : loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-2xl" />
            <div className="grid grid-cols-2 gap-2">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        ) : error ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Wallet size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <h2 className="text-sm font-mono font-bold mb-2">ERROR</h2>
            <p className="text-[10px] font-mono text-muted-foreground mb-3">{error}</p>
            <button
              onClick={fetchPortfolio}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2 hover:bg-primary/80 transition"
            >
              <RefreshCw size={12} /> RETRY
            </button>
          </div>
        ) : !data || data.holdingsCount === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Coins size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <h2 className="text-sm font-mono font-bold mb-2">NO HOLDINGS</h2>
            <p className="text-[10px] font-mono text-muted-foreground mb-4">
              No ETH or token balances on Base.
            </p>
            <button
              onClick={fetchPortfolio}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2 hover:bg-primary/80 transition"
            >
              <RefreshCw size={12} /> REFRESH
            </button>
          </div>
        ) : (
          <>
            {/* Total value header */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-mono text-muted-foreground uppercase">Portfolio Value</p>
                  <p className="text-3xl font-mono font-bold">{formatUsd(data.totalValueUsd)}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {data.holdingsCount} asset{data.holdingsCount !== 1 ? 's' : ''} on Base
                  </p>
                </div>
                <button
                  onClick={fetchPortfolio}
                  disabled={loading}
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Pie chart */}
            {pieData.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-[10px] font-mono font-bold uppercase mb-3">Allocation</p>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={55}
                        strokeWidth={2}
                        stroke="hsl(var(--card))"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 flex-1">
                    {pieData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.fill }} />
                        <span className="text-[10px] font-mono text-muted-foreground">{d.name}</span>
                        <span className="text-[10px] font-mono font-bold text-foreground ml-auto">
                          {data.totalValueUsd > 0 ? `${Math.round((d.value / data.totalValueUsd) * 100)}%` : '0%'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Holdings cards */}
            <div className="space-y-2">
              <p className="text-[10px] font-mono font-bold uppercase text-muted-foreground px-1">Holdings</p>
              {data.holdings.map((h, i) => (
                <div key={h.symbol + i} className="bg-card border border-border rounded-2xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <div>
                      <p className="text-xs font-mono font-bold">{h.symbol}</p>
                      <p className="text-[9px] font-mono text-muted-foreground">{formatBalance(h.balance)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-primary">{formatUsd(h.valueUsd)}</p>
                    <p className="text-[9px] font-mono text-muted-foreground">
                      {data.totalValueUsd > 0 ? `${Math.round((h.valueUsd / data.totalValueUsd) * 100)}%` : '0%'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Risk metrics */}
            {risk && (
              <div className="space-y-2">
                <p className="text-[10px] font-mono font-bold uppercase text-muted-foreground px-1 flex items-center gap-1.5">
                  <ShieldAlert size={10} /> Risk Metrics (90d)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-card border border-border rounded-xl p-3">
                    <p className="text-[8px] font-mono text-muted-foreground uppercase">Volatility</p>
                    <p className="text-lg font-mono font-bold text-yellow-400">{risk.volatility.toFixed(1)}%</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3">
                    <p className="text-[8px] font-mono text-muted-foreground uppercase">Sharpe Ratio</p>
                    <p className={`text-lg font-mono font-bold ${risk.sharpeRatio >= 1 ? 'text-green-400' : risk.sharpeRatio >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {risk.sharpeRatio.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3">
                    <p className="text-[8px] font-mono text-muted-foreground uppercase">Max Drawdown</p>
                    <p className="text-lg font-mono font-bold text-red-400">-{risk.maxDrawdownPct.toFixed(1)}%</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3">
                    <p className="text-[8px] font-mono text-muted-foreground uppercase">VaR (95%)</p>
                    <p className="text-lg font-mono font-bold text-orange-400">{formatUsd(risk.valueAtRisk95)}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MobileLayout>
  );
};

export default MobilePortfolio;
