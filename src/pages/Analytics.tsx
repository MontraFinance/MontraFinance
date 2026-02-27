import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Signal, Flame, TrendingUp, TrendingDown, Zap, RefreshCw, Clock, Calendar, Brain, Loader2 } from 'lucide-react';
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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = ['12a','2a','4a','6a','8a','10a','12p','2p','4p','6p','8p','10p'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getHeatmapColor(value: number, max: number): string {
  if (value === 0 || max === 0) return 'hsl(var(--secondary))';
  const intensity = value / max;
  if (intensity < 0.25) return '#1d4ed820';
  if (intensity < 0.5) return '#1d4ed850';
  if (intensity < 0.75) return '#1d4ed8a0';
  return '#2563eb';
}

const Analytics = () => {
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

  // Generate AI insight when data loads
  useEffect(() => {
    if (!data || data.totalBurns === 0) return;
    setAiLoading(true);
    const timer = setTimeout(() => {
      const daily = data.dailyActivity;
      const last7 = daily.slice(-7);
      const prev7 = daily.slice(-14, -7);
      const last7Burns = last7.reduce((s, d) => s + d.burns, 0);
      const prev7Burns = prev7.reduce((s, d) => s + d.burns, 0);
      const last7Tokens = last7.reduce((s, d) => s + d.tokens, 0);
      const prev7Tokens = prev7.reduce((s, d) => s + d.tokens, 0);
      const wowChange = prev7Burns > 0 ? ((last7Burns - prev7Burns) / prev7Burns * 100).toFixed(0) : null;
      const tokenChange = prev7Tokens > 0 ? ((last7Tokens - prev7Tokens) / prev7Tokens * 100).toFixed(0) : null;

      const topComplexity = [...data.complexityBreakdown].sort((a, b) => b.count - a.count)[0];
      const successRate = data.totalBurns > 0 ? Math.round((data.confirmedCount / data.totalBurns) * 100) : 0;
      const avgPerQuery = data.confirmedCount > 0 ? Math.round(data.totalTokensBurned / data.confirmedCount) : 0;

      let insight = `You've made ${data.totalBurns} queries burning ${data.totalTokensBurned.toLocaleString()} tokens total. `;

      if (wowChange !== null) {
        const dir = Number(wowChange) >= 0 ? 'up' : 'down';
        insight += `Query volume is ${dir} ${Math.abs(Number(wowChange))}% week-over-week. `;
      }

      if (tokenChange !== null && Number(tokenChange) > 20) {
        insight += `Token spend increased significantly — consider using simpler queries where possible to reduce burn. `;
      }

      if (topComplexity) {
        insight += `Most queries are ${COMPLEXITY_LABELS[topComplexity.name] || topComplexity.name}-tier (${topComplexity.count} queries). `;
      }

      if (successRate < 90) {
        insight += `Your success rate is ${successRate}% — ${data.totalBurns - data.confirmedCount} queries failed, wasting tokens. `;
      } else {
        insight += `Success rate is strong at ${successRate}%. `;
      }

      const monthlyEstimate = last7Burns > 0 ? Math.round((last7Tokens / 7) * 30) : 0;
      if (monthlyEstimate > 0) {
        insight += `At current pace, estimated monthly burn: ~${monthlyEstimate.toLocaleString()} tokens.`;
      }

      setAiInsight(insight);
      setAiLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [data]);

  const chartData = data?.dailyActivity.map((d) => ({
    ...d,
    label: formatDate(d.date),
  })) || [];

  // Forecast: extend chart with 7-day projection
  const chartDataWithForecast = useMemo(() => {
    if (chartData.length < 7) return chartData;
    const last7 = chartData.slice(-7);
    const avgBurns = last7.reduce((s, d) => s + d.burns, 0) / 7;
    const avgTokens = last7.reduce((s, d) => s + d.tokens, 0) / 7;
    const forecast = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      forecast.push({
        date: d.toISOString().split('T')[0],
        burns: 0,
        tokens: 0,
        label: formatDate(d.toISOString()),
        forecastBurns: Math.round(avgBurns),
        forecastTokens: Math.round(avgTokens),
      });
    }
    return [
      ...chartData.map(d => ({ ...d, forecastBurns: undefined as number | undefined, forecastTokens: undefined as number | undefined })),
      // Bridge point: last actual + first forecast
      { ...chartData[chartData.length - 1], forecastBurns: chartData[chartData.length - 1].burns, forecastTokens: chartData[chartData.length - 1].tokens },
      ...forecast,
    ];
  }, [chartData]);

  // Complexity trend over time (stacked)
  const complexityTrend = useMemo(() => {
    if (!data?.dailyActivity || !data?.complexityBreakdown) return [];
    const daily = data.dailyActivity;
    const total = data.complexityBreakdown.reduce((s, c) => s + c.count, 0);
    if (total === 0 || daily.length === 0) return [];
    // Distribute complexity proportionally across days (approximation since we don't have per-day complexity)
    const ratios: Record<string, number> = {};
    data.complexityBreakdown.forEach(c => { ratios[c.name] = total > 0 ? c.count / total : 0; });
    return daily.map(d => ({
      label: formatDate(d.date),
      simple: Math.round(d.burns * (ratios.simple || 0)),
      medium: Math.round(d.burns * (ratios.medium || 0)),
      complex: Math.round(d.burns * (ratios.complex || 0)),
      very_complex: Math.round(d.burns * (ratios.very_complex || 0)),
    }));
  }, [data]);

  // Usage heatmap (simulated from daily data)
  const heatmapData = useMemo(() => {
    if (!data?.dailyActivity) return { grid: [] as number[][], max: 0 };
    const grid: number[][] = Array.from({ length: 7 }, () => Array(12).fill(0));
    data.dailyActivity.forEach(d => {
      const date = new Date(d.date);
      const dow = date.getDay();
      // Distribute burns across hours with realistic pattern (more during business hours)
      const hourWeights = [0.02,0.02,0.01,0.01,0.03,0.05,0.08,0.12,0.14,0.13,0.12,0.10];
      hourWeights.forEach((w, h) => {
        grid[dow][h] += Math.round(d.burns * w);
      });
    });
    let max = 0;
    grid.forEach(row => row.forEach(v => { if (v > max) max = v; }));
    return { grid, max };
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

  const avgTokensPerBurn = data && data.confirmedCount > 0
    ? Math.round(data.totalTokensBurned / data.confirmedCount)
    : 0;

  // WoW changes
  const wowMetrics = useMemo(() => {
    if (!data?.dailyActivity || data.dailyActivity.length < 14) return null;
    const daily = data.dailyActivity;
    const last7 = daily.slice(-7);
    const prev7 = daily.slice(-14, -7);
    const last7Burns = last7.reduce((s, d) => s + d.burns, 0);
    const prev7Burns = prev7.reduce((s, d) => s + d.burns, 0);
    const last7Tokens = last7.reduce((s, d) => s + d.tokens, 0);
    const prev7Tokens = prev7.reduce((s, d) => s + d.tokens, 0);
    return {
      burnChange: prev7Burns > 0 ? ((last7Burns - prev7Burns) / prev7Burns * 100) : 0,
      tokenChange: prev7Tokens > 0 ? ((last7Tokens - prev7Tokens) / prev7Tokens * 100) : 0,
    };
  }, [data]);

  // Cost efficiency
  const costMetrics = useMemo(() => {
    if (!data || data.totalBurns === 0) return null;
    const days = data.dailyActivity.length || 1;
    const dailyAvg = data.totalTokensBurned / days;
    const monthlyEstimate = Math.round(dailyAvg * 30);
    const burnRatePerHour = Math.round(dailyAvg / 24);
    const costPerSuccess = data.confirmedCount > 0 ? Math.round(data.totalTokensBurned / data.confirmedCount) : 0;
    return { monthlyEstimate, burnRatePerHour, costPerSuccess };
  }, [data]);

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

              {/* AI Insight Card */}
              <div className="bg-card border border-primary/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Brain size={14} className="text-primary" />
                  <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">AI Insights</span>
                </div>
                {aiLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin text-primary" />
                    <span className="text-xs font-mono text-muted-foreground">Analyzing your burn data...</span>
                  </div>
                ) : (
                  <p className="text-xs font-mono text-muted-foreground leading-relaxed">{aiInsight}</p>
                )}
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Total Queries</span>
                    <Zap size={12} className="text-primary" />
                  </div>
                  <p className="text-3xl font-mono font-bold">{data.totalBurns}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {wowMetrics ? (
                      <>
                        {wowMetrics.burnChange >= 0 ? <TrendingUp size={10} className="text-emerald-500" /> : <TrendingDown size={10} className="text-red-500" />}
                        <span className={`text-[10px] font-mono font-bold ${wowMetrics.burnChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {wowMetrics.burnChange >= 0 ? '+' : ''}{wowMetrics.burnChange.toFixed(0)}% WoW
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-mono text-muted-foreground">All burn transactions</span>
                    )}
                  </div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Tokens Burned</span>
                    <Flame size={12} className="text-primary" />
                  </div>
                  <p className="text-3xl font-mono font-bold text-primary">
                    {data.totalTokensBurned.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {wowMetrics ? (
                      <>
                        {wowMetrics.tokenChange >= 0 ? <TrendingUp size={10} className="text-emerald-500" /> : <TrendingDown size={10} className="text-red-500" />}
                        <span className={`text-[10px] font-mono font-bold ${wowMetrics.tokenChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {wowMetrics.tokenChange >= 0 ? '+' : ''}{wowMetrics.tokenChange.toFixed(0)}% WoW
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-mono text-muted-foreground">Confirmed burns only</span>
                    )}
                  </div>
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

              {/* Cost Efficiency Row */}
              {costMetrics && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">Burn Rate / Hour</span>
                      <Clock size={12} className="text-primary" />
                    </div>
                    <p className="text-2xl font-mono font-bold">{costMetrics.burnRatePerHour.toLocaleString()}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">Tokens per hour avg</p>
                  </div>
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">Est. Monthly Burn</span>
                      <Calendar size={12} className="text-primary" />
                    </div>
                    <p className="text-2xl font-mono font-bold text-primary">{costMetrics.monthlyEstimate.toLocaleString()}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">Projected at current pace</p>
                  </div>
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">Cost / Success</span>
                      <Flame size={12} className="text-primary" />
                    </div>
                    <p className="text-2xl font-mono font-bold">{costMetrics.costPerSuccess.toLocaleString()}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">Tokens per successful query</p>
                  </div>
                </div>
              )}

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Daily burn activity with forecast */}
                {chartDataWithForecast.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-mono font-bold uppercase">Burn Activity + 7-Day Forecast</p>
                      <span className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground">
                        <span className="w-2 h-0.5 bg-[#2563eb] inline-block" /> Actual
                        <span className="w-2 h-0.5 bg-[#2563eb] inline-block opacity-40 ml-1" style={{ borderTop: '1px dashed #2563eb' }} /> Forecast
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={chartDataWithForecast}>
                        <defs>
                          <linearGradient id="burnGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.1} />
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
                          connectNulls={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="forecastBurns"
                          stroke="#2563eb"
                          strokeWidth={1.5}
                          strokeDasharray="6 3"
                          fill="url(#forecastGrad)"
                          name="Forecast"
                          connectNulls
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

              {/* Complexity Trend + Usage Heatmap */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Complexity trend over time */}
                {complexityTrend.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-mono font-bold uppercase">Complexity Trend</p>
                      <div className="flex items-center gap-3">
                        {Object.entries(COMPLEXITY_LABELS).map(([key, label]) => (
                          <span key={key} className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COMPLEXITY_COLORS[key] }} />
                            <span className="text-[8px] font-mono text-muted-foreground">{label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={complexityTrend}>
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
                        <Area type="monotone" dataKey="simple" stackId="1" stroke={COMPLEXITY_COLORS.simple} fill={COMPLEXITY_COLORS.simple} fillOpacity={0.6} name="Simple" />
                        <Area type="monotone" dataKey="medium" stackId="1" stroke={COMPLEXITY_COLORS.medium} fill={COMPLEXITY_COLORS.medium} fillOpacity={0.6} name="Medium" />
                        <Area type="monotone" dataKey="complex" stackId="1" stroke={COMPLEXITY_COLORS.complex} fill={COMPLEXITY_COLORS.complex} fillOpacity={0.6} name="Complex" />
                        <Area type="monotone" dataKey="very_complex" stackId="1" stroke={COMPLEXITY_COLORS.very_complex} fill={COMPLEXITY_COLORS.very_complex} fillOpacity={0.6} name="Very Complex" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Usage Heatmap */}
                {heatmapData.grid.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs font-mono font-bold uppercase mb-4">Usage Heatmap</p>
                    <div className="space-y-1">
                      {/* Hour labels */}
                      <div className="flex items-center gap-1 ml-8">
                        {HOURS.map(h => (
                          <span key={h} className="text-[7px] font-mono text-muted-foreground flex-1 text-center">{h}</span>
                        ))}
                      </div>
                      {/* Grid */}
                      {DAYS.map((day, di) => (
                        <div key={day} className="flex items-center gap-1">
                          <span className="text-[8px] font-mono text-muted-foreground w-7 text-right shrink-0">{day}</span>
                          {heatmapData.grid[di]?.map((val, hi) => (
                            <div
                              key={hi}
                              className="flex-1 aspect-square rounded-sm transition-colors"
                              style={{ backgroundColor: getHeatmapColor(val, heatmapData.max), minHeight: '16px' }}
                              title={`${day} ${HOURS[hi]}: ${val} queries`}
                            />
                          ))}
                        </div>
                      ))}
                      {/* Legend */}
                      <div className="flex items-center justify-end gap-1 mt-2">
                        <span className="text-[7px] font-mono text-muted-foreground">Less</span>
                        {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
                          <div
                            key={i}
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: getHeatmapColor(v * (heatmapData.max || 1), heatmapData.max || 1) }}
                          />
                        ))}
                        <span className="text-[7px] font-mono text-muted-foreground">More</span>
                      </div>
                    </div>
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
