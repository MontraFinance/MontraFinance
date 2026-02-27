import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Signal, Flame, Zap, TrendingUp, TrendingDown, RefreshCw, Brain, Loader2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import MobileLayout from '@/components/MobileLayout';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { useWallet } from '@/contexts/WalletContext';
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
  simple: '#059669', medium: '#d97706', complex: '#ea580c', very_complex: '#dc2626',
};
const STATUS_COLORS: Record<string, string> = {
  pending: '#d97706', signed: '#2563eb', confirmed: '#059669', processed: '#059669', failed: '#dc2626',
};
const COMPLEXITY_LABELS: Record<string, string> = {
  simple: 'Simple', medium: 'Medium', complex: 'Complex', very_complex: 'V. Complex',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '10px',
  fontFamily: 'monospace',
};

const MobileAnalytics = () => {
  const { connected, fullWalletAddress } = useWallet();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchAnalytics = () => {
    if (!connected || !fullWalletAddress) return;
    setLoading(true);
    setError(null);
    fetch(`/api/burn/analytics?wallet=${encodeURIComponent(fullWalletAddress)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res);
        else setError(res.error || 'Failed to load analytics');
      })
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAnalytics(); }, [connected, fullWalletAddress]);

  // Generate AI insight
  useEffect(() => {
    if (!data || data.totalBurns === 0) return;
    setAiLoading(true);
    const timer = setTimeout(() => {
      const daily = data.dailyActivity;
      const last7 = daily.slice(-7);
      const prev7 = daily.slice(-14, -7);
      const last7Burns = last7.reduce((s, d) => s + d.burns, 0);
      const prev7Burns = prev7.reduce((s, d) => s + d.burns, 0);
      const wowChange = prev7Burns > 0 ? ((last7Burns - prev7Burns) / prev7Burns * 100).toFixed(0) : null;
      const successRate = data.totalBurns > 0 ? Math.round((data.confirmedCount / data.totalBurns) * 100) : 0;

      let insight = `${data.totalBurns} queries, ${data.totalTokensBurned.toLocaleString()} tokens burned. `;
      if (wowChange !== null) {
        insight += `Volume ${Number(wowChange) >= 0 ? 'up' : 'down'} ${Math.abs(Number(wowChange))}% WoW. `;
      }
      insight += `Success rate: ${successRate}%.`;
      setAiInsight(insight);
      setAiLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [data]);

  const chartData = data?.dailyActivity.map((d) => ({ ...d, label: formatDate(d.date) })) || [];

  const wowMetrics = useMemo(() => {
    if (!data?.dailyActivity || data.dailyActivity.length < 14) return null;
    const daily = data.dailyActivity;
    const last7 = daily.slice(-7);
    const prev7 = daily.slice(-14, -7);
    return {
      burnChange: prev7.reduce((s, d) => s + d.burns, 0) > 0
        ? ((last7.reduce((s, d) => s + d.burns, 0) - prev7.reduce((s, d) => s + d.burns, 0)) / prev7.reduce((s, d) => s + d.burns, 0) * 100)
        : 0,
    };
  }, [data]);

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

  return (
    <MobileLayout>
      <div className="py-3 space-y-3">
        {!connected ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Signal size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <h2 className="text-sm font-mono font-bold mb-2">WALLET REQUIRED</h2>
            <p className="text-[10px] font-mono text-muted-foreground mb-4">
              Connect your wallet to view burn analytics.
            </p>
            <ConnectWalletButton />
          </div>
        ) : loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        ) : error ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Signal size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <h2 className="text-sm font-mono font-bold mb-2">ERROR</h2>
            <p className="text-[10px] font-mono text-muted-foreground mb-3">{error}</p>
            <button
              onClick={fetchAnalytics}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2 hover:bg-primary/80 transition"
            >
              <RefreshCw size={12} /> RETRY
            </button>
          </div>
        ) : !data || data.totalBurns === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Flame size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <h2 className="text-sm font-mono font-bold mb-2">NO DATA YET</h2>
            <p className="text-[10px] font-mono text-muted-foreground mb-4">
              Burn tokens to see analytics.
            </p>
            <Link
              to="/baseapp"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2 hover:bg-primary/80 transition"
            >
              GO TO TERMINAL
            </Link>
          </div>
        ) : (
          <>
            {/* AI Insight */}
            <div className="bg-card border border-primary/20 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Brain size={12} className="text-primary" />
                <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest">AI Insights</span>
              </div>
              {aiLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={10} className="animate-spin text-primary" />
                  <span className="text-[10px] font-mono text-muted-foreground">Analyzing...</span>
                </div>
              ) : (
                <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">{aiInsight}</p>
              )}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] font-mono text-muted-foreground uppercase">Queries</span>
                  <Zap size={10} className="text-primary" />
                </div>
                <p className="text-2xl font-mono font-bold">{data.totalBurns}</p>
                {wowMetrics && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {wowMetrics.burnChange >= 0 ? <TrendingUp size={8} className="text-emerald-500" /> : <TrendingDown size={8} className="text-red-500" />}
                    <span className={`text-[9px] font-mono font-bold ${wowMetrics.burnChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {wowMetrics.burnChange >= 0 ? '+' : ''}{wowMetrics.burnChange.toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] font-mono text-muted-foreground uppercase">Burned</span>
                  <Flame size={10} className="text-primary" />
                </div>
                <p className="text-2xl font-mono font-bold text-primary">{data.totalTokensBurned.toLocaleString()}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] font-mono text-muted-foreground uppercase">Avg/Query</span>
                  <TrendingUp size={10} className="text-primary" />
                </div>
                <p className="text-2xl font-mono font-bold">
                  {data.confirmedCount > 0 ? Math.round(data.totalTokensBurned / data.confirmedCount).toLocaleString() : '0'}
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] font-mono text-muted-foreground uppercase">Success</span>
                  <Signal size={10} className="text-primary" />
                </div>
                <p className="text-2xl font-mono font-bold text-emerald-500">
                  {data.totalBurns > 0 ? `${Math.round((data.confirmedCount / data.totalBurns) * 100)}%` : '\u2014'}
                </p>
              </div>
            </div>

            {/* Burn activity chart */}
            {chartData.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-3">
                <p className="text-[10px] font-mono font-bold uppercase mb-3">Burn Activity</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="mburnGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'hsl(var(--muted-foreground))' }}
                      allowDecimals={false}
                      width={30}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="burns" stroke="#2563eb" strokeWidth={2} fill="url(#mburnGrad)" name="Burns" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tokens per day bar chart */}
            {chartData.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-3">
                <p className="text-[10px] font-mono font-bold uppercase mb-3">Tokens Burned / Day</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'hsl(var(--muted-foreground))' }}
                      width={35}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="tokens" fill="#2563eb" radius={[4, 4, 0, 0]} name="Tokens" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Complexity pie */}
            {complexityData.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-3">
                <p className="text-[10px] font-mono font-bold uppercase mb-3">Query Complexity</p>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={110} height={110}>
                    <PieChart>
                      <Pie
                        data={complexityData}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={28}
                        outerRadius={50}
                        strokeWidth={2}
                        stroke="hsl(var(--card))"
                      >
                        {complexityData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 flex-1">
                    {complexityData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.fill }} />
                        <span className="text-[10px] font-mono text-muted-foreground">{d.label}</span>
                        <span className="text-[10px] font-mono font-bold text-foreground ml-auto">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Status pie */}
            {statusData.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-3">
                <p className="text-[10px] font-mono font-bold uppercase mb-3">Transaction Status</p>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={110} height={110}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={28}
                        outerRadius={50}
                        strokeWidth={2}
                        stroke="hsl(var(--card))"
                      >
                        {statusData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 flex-1">
                    {statusData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.fill }} />
                        <span className="text-[10px] font-mono text-muted-foreground">{d.label}</span>
                        <span className="text-[10px] font-mono font-bold text-foreground ml-auto">{d.count}</span>
                      </div>
                    ))}
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

export default MobileAnalytics;
