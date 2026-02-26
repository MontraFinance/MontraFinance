import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Signal, Flame, TrendingUp, Zap, RefreshCw } from 'lucide-react';
import LaunchCountdown from '@/components/LaunchCountdown';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { useWallet } from '@/contexts/WalletContext';
import { AppSidebar } from '@/components/AppSidebar';
import { Skeleton } from '@/components/ui/skeleton';

interface AnalyticsData {
  success: boolean;
  totalBurns: number;
  totalTokensBurned: number;
  confirmedCount: number;
  complexityBreakdown: { name: string; count: number }[];
  statusBreakdown: { name: string; count: number }[];
  dailyActivity: { date: string; burns: number; tokens: number }[];
}

const COMPLEXITY_COLORS: Record<string, string> = {
  simple: '#059669',
  medium: '#d97706',
  complex: '#ea580c',
  very_complex: '#dc2626',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#d97706',
  signed: '#2563eb',
  confirmed: '#059669',
  processed: '#059669',
  failed: '#dc2626',
};

const COMPLEXITY_LABELS: Record<string, string> = {
  simple: 'Simple',
  medium: 'Medium',
  complex: 'Complex',
  very_complex: 'Very Complex',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const Analytics = () => {
  const { connected, fullWalletAddress } = useWallet();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = () => {
    if (!connected || !fullWalletAddress) return;
    setLoading(true);
    setError(null);
    fetch(`/api/burn/analytics?wallet=${encodeURIComponent(fullWalletAddress)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res);
        } else {
          setError(res.error || 'Failed to load analytics');
        }
      })
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAnalytics();
  }, [connected, fullWalletAddress]);

  const chartData = data?.dailyActivity.map((d) => ({
    ...d,
    label: formatDate(d.date),
  })) || [];

  const complexityData = data?.complexityBreakdown.map((d) => ({
    ...d,
    label: COMPLEXITY_LABELS[d.name] || d.name,
    fill: COMPLEXITY_COLORS[d.name] || '#6b7280',
  })) || [];

  const statusData = data?.statusBreakdown.map((d) => ({
    ...d,
    label: d.name.charAt(0).toUpperCase() + d.name.slice(1),
    fill: STATUS_COLORS[d.name] || '#6b7280',
  })) || [];

  const avgTokensPerBurn = data && data.confirmedCount > 0
    ? Math.round(data.totalTokensBurned / data.confirmedCount)
    : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LaunchCountdown title="Analytics" />
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-mono font-bold tracking-wider">ANALYTICS</h1>
          <span className="text-xs font-mono text-primary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            BURN METRICS
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
            {new Date().toLocaleString()}
          </span>
          <ConnectWalletButton />
        </div>
      </header>

      <div className="flex">
        <AppSidebar activePage="analytics" />

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6">
          {!connected ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Signal size={40} className="text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-sm font-mono font-bold text-foreground mb-2">WALLET REQUIRED</h2>
              <p className="text-[10px] font-mono text-muted-foreground mb-6">
                Connect your wallet to view burn analytics.
              </p>
              <ConnectWalletButton />
            </div>
          ) : loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Skeleton className="h-64 rounded-2xl" />
                <Skeleton className="h-64 rounded-2xl" />
              </div>
            </div>
          ) : error ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Signal size={40} className="text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-sm font-mono font-bold text-foreground mb-2">ERROR</h2>
              <p className="text-[10px] font-mono text-muted-foreground mb-4">{error}</p>
              <button
                onClick={fetchAnalytics}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2.5 hover:bg-primary/80 transition"
              >
                <RefreshCw size={12} /> RETRY
              </button>
            </div>
          ) : !data || data.totalBurns === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Flame size={40} className="text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-sm font-mono font-bold text-foreground mb-2">NO DATA YET</h2>
              <p className="text-[10px] font-mono text-muted-foreground mb-6">
                Burn tokens to query the AI terminal and your analytics will appear here.
              </p>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2.5 hover:bg-primary/80 transition"
              >
                GO TO TERMINAL
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Total Queries</span>
                    <Zap size={12} className="text-primary" />
                  </div>
                  <p className="text-3xl font-mono font-bold">{data.totalBurns}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">All burn transactions</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Tokens Burned</span>
                    <Flame size={12} className="text-primary" />
                  </div>
                  <p className="text-3xl font-mono font-bold text-primary">
                    {data.totalTokensBurned.toLocaleString()}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">Confirmed burns only</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Avg per Query</span>
                    <TrendingUp size={12} className="text-primary" />
                  </div>
                  <p className="text-3xl font-mono font-bold">
                    {avgTokensPerBurn.toLocaleString()}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">Tokens per query avg</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Success Rate</span>
                    <Activity size={12} className="text-primary" />
                  </div>
                  <p className="text-3xl font-mono font-bold text-emerald-600">
                    {data.totalBurns > 0
                      ? `${Math.round((data.confirmedCount / data.totalBurns) * 100)}%`
                      : '—'}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">
                    {data.confirmedCount} / {data.totalBurns} confirmed
                  </p>
                </div>
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Daily burn activity */}
                {chartData.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs font-mono font-bold uppercase mb-4">Burn Activity (Last 90 Days)</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="burnGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fontFamily: 'monospace', fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fontFamily: 'monospace', fill: 'hsl(var(--muted-foreground))' }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="burns"
                          stroke="#2563eb"
                          strokeWidth={2}
                          fill="url(#burnGrad)"
                          name="Burns"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Tokens burned per day */}
                {chartData.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs font-mono font-bold uppercase mb-4">Tokens Burned per Day</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fontFamily: 'monospace', fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fontFamily: 'monospace', fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                          }}
                        />
                        <Bar dataKey="tokens" fill="#2563eb" radius={[4, 4, 0, 0]} name="Tokens" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Bottom row — breakdowns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Complexity breakdown */}
                {complexityData.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs font-mono font-bold uppercase mb-4">Query Complexity</p>
                    <div className="flex items-center gap-6">
                      <ResponsiveContainer width={160} height={160}>
                        <PieChart>
                          <Pie
                            data={complexityData}
                            dataKey="count"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            strokeWidth={2}
                            stroke="hsl(var(--card))"
                          >
                            {complexityData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {complexityData.map((d) => (
                          <div key={d.name} className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                            <span className="text-xs font-mono text-muted-foreground">{d.label}</span>
                            <span className="text-xs font-mono font-bold text-foreground ml-auto">{d.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Status breakdown */}
                {statusData.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs font-mono font-bold uppercase mb-4">Transaction Status</p>
                    <div className="flex items-center gap-6">
                      <ResponsiveContainer width={160} height={160}>
                        <PieChart>
                          <Pie
                            data={statusData}
                            dataKey="count"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            strokeWidth={2}
                            stroke="hsl(var(--card))"
                          >
                            {statusData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {statusData.map((d) => (
                          <div key={d.name} className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                            <span className="text-xs font-mono text-muted-foreground">{d.label}</span>
                            <span className="text-xs font-mono font-bold text-foreground ml-auto">{d.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Analytics;
