import { useState } from 'react';
import {
  DollarSign, TrendingUp, Activity, Users, RefreshCw,
  ArrowUpRight, BarChart3, Clock, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { AppSidebar } from '@/components/AppSidebar';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import TierBadge from '@/components/TierBadge';
import { useRevenue } from '@/hooks/useRevenue';

// ── Helpers ──

const DashboardCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-card border border-border rounded-2xl p-4 ${className}`}>{children}</div>
);

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Icon size={14} className="text-primary" />
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
        {title}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function formatUsdc(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n > 0) return `$${n.toFixed(4)}`;
  return '$0.00';
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const PIE_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e5', '#be185d'];

// ── Main Page ──

export default function RevenueTracker() {
  const { data, loading, error, refresh } = useRevenue(30_000);
  const [chartView, setChartView] = useState<'area' | 'bar'>('area');

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <AppSidebar activePage="revenue" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground font-mono text-sm animate-pulse">Loading revenue data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activePage="revenue" />

      <div className="flex-1 overflow-y-auto">
        {/* ── Header ── */}
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign size={18} className="text-green-500" />
              <span className="text-sm font-bold font-mono">Revenue Tracker</span>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                x402 LIVE
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={refresh}
                className="text-muted-foreground hover:text-foreground transition"
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
              <TierBadge />
              <ConnectWalletButton />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <DashboardCard className="border-yellow-500/30">
              <p className="text-xs text-yellow-400 font-mono">
                Unable to fetch revenue data. Displaying cached values.
              </p>
            </DashboardCard>
          )}

          {/* ── Section A: Key Metrics ── */}
          <div>
            <SectionHeader icon={Activity} title="Revenue Overview" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DashboardCard>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={14} className="text-green-500" />
                  <span className="text-[10px] text-muted-foreground font-mono uppercase">Total Revenue</span>
                </div>
                <p className="text-xl font-bold font-mono text-green-500">{formatUsdc(data.totalRevenue)}</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-1">USDC earned via x402</p>
              </DashboardCard>

              <DashboardCard>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={14} className="text-blue-400" />
                  <span className="text-[10px] text-muted-foreground font-mono uppercase">24h Revenue</span>
                </div>
                <p className="text-xl font-bold font-mono text-blue-400">{formatUsdc(data.revenue24h)}</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-1">
                  7d: {formatUsdc(data.revenue7d)} · 30d: {formatUsdc(data.revenue30d)}
                </p>
              </DashboardCard>

              <DashboardCard>
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={14} className="text-purple-400" />
                  <span className="text-[10px] text-muted-foreground font-mono uppercase">Total Payments</span>
                </div>
                <p className="text-xl font-bold font-mono">{formatNumber(data.totalPayments)}</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-1">
                  Avg: {formatUsdc(data.avgPayment)}/call
                </p>
              </DashboardCard>

              <DashboardCard>
                <div className="flex items-center gap-2 mb-2">
                  <Users size={14} className="text-orange-400" />
                  <span className="text-[10px] text-muted-foreground font-mono uppercase">Unique Payers</span>
                </div>
                <p className="text-xl font-bold font-mono">{formatNumber(data.uniquePayers)}</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-1">distinct wallets</p>
              </DashboardCard>
            </div>
          </div>

          {/* ── Section B: Revenue Over Time ── */}
          {data.dailyRevenue.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <SectionHeader icon={BarChart3} title="Revenue Over Time" />
                <div className="flex gap-1">
                  <button
                    onClick={() => setChartView('area')}
                    className={`text-[10px] font-mono px-2 py-1 rounded ${chartView === 'area' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Area
                  </button>
                  <button
                    onClick={() => setChartView('bar')}
                    className={`text-[10px] font-mono px-2 py-1 rounded ${chartView === 'bar' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Bar
                  </button>
                </div>
              </div>
              <DashboardCard>
                <ResponsiveContainer width="100%" height={280}>
                  {chartView === 'area' ? (
                    <AreaChart data={data.dailyRevenue}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgb(63, 63, 70)" />
                      <XAxis
                        dataKey="date"
                        stroke="rgb(113, 113, 122)"
                        tick={{ fontSize: 10, fontFamily: 'monospace' }}
                        tickFormatter={(d) => d.slice(5)}
                      />
                      <YAxis
                        stroke="rgb(113, 113, 122)"
                        tick={{ fontSize: 10, fontFamily: 'monospace' }}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                        }}
                        formatter={(v: number) => [`$${v.toFixed(4)}`, 'Revenue']}
                        labelFormatter={(l) => l}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#22c55e"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={data.dailyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgb(63, 63, 70)" />
                      <XAxis
                        dataKey="date"
                        stroke="rgb(113, 113, 122)"
                        tick={{ fontSize: 10, fontFamily: 'monospace' }}
                        tickFormatter={(d) => d.slice(5)}
                      />
                      <YAxis
                        stroke="rgb(113, 113, 122)"
                        tick={{ fontSize: 10, fontFamily: 'monospace' }}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                        }}
                        formatter={(v: number) => [`$${v.toFixed(4)}`, 'Revenue']}
                      />
                      <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </DashboardCard>
            </div>
          )}

          {/* ── Section C: Buyback Flywheel ── */}
          {data.buyback.totalOrders > 0 && (
            <div>
              <SectionHeader icon={Zap} title="Buyback Flywheel" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <DashboardCard className="border-green-500/20">
                  <span className="text-[10px] text-muted-foreground font-mono uppercase">USDC Bought Back</span>
                  <p className="text-lg font-bold font-mono text-green-500 mt-1">
                    {formatUsdc(data.buyback.totalUsdcBoughtBack)}
                  </p>
                </DashboardCard>
                <DashboardCard className="border-orange-500/20">
                  <span className="text-[10px] text-muted-foreground font-mono uppercase">$MONTRA Burned</span>
                  <p className="text-lg font-bold font-mono text-orange-400 mt-1">
                    {formatNumber(data.buyback.totalMontraBurned)}
                  </p>
                </DashboardCard>
                <DashboardCard className="border-blue-500/20">
                  <span className="text-[10px] text-muted-foreground font-mono uppercase">Buyback Orders</span>
                  <p className="text-lg font-bold font-mono text-blue-400 mt-1">
                    {formatNumber(data.buyback.totalOrders)}
                  </p>
                </DashboardCard>
              </div>
            </div>
          )}

          {/* ── Section D: Endpoint Breakdown ── */}
          {data.byEndpoint.length > 0 && (
            <div>
              <SectionHeader icon={BarChart3} title="Revenue by Endpoint" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DashboardCard>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={data.byEndpoint}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={45}
                        dataKey="total"
                        nameKey="endpoint"
                        paddingAngle={2}
                      >
                        {data.byEndpoint.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                        }}
                        formatter={(v: number) => [`$${v.toFixed(4)}`, 'Revenue']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </DashboardCard>

                <DashboardCard>
                  <div className="space-y-2">
                    {data.byEndpoint.map((ep, i) => (
                      <div key={ep.endpoint} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="text-xs font-mono text-muted-foreground">{ep.endpoint}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-mono text-muted-foreground">{ep.count} calls</span>
                          <span className="text-xs font-bold font-mono">{formatUsdc(ep.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </DashboardCard>
              </div>
            </div>
          )}

          {/* ── Section E: Recent Payments ── */}
          {data.recentPayments.length > 0 && (
            <div>
              <SectionHeader icon={Clock} title="Recent Payments" />
              <DashboardCard>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="text-[10px] text-muted-foreground uppercase border-b border-border">
                        <th className="text-left py-2 pr-4">Time</th>
                        <th className="text-left py-2 pr-4">Payer</th>
                        <th className="text-left py-2 pr-4">Endpoint</th>
                        <th className="text-right py-2 pr-4">Amount</th>
                        <th className="text-right py-2">Discount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentPayments.map((p, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition">
                          <td className="py-2 pr-4 text-muted-foreground">{timeAgo(p.time)}</td>
                          <td className="py-2 pr-4">
                            <span className="text-primary">{p.payer}</span>
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">{p.endpoint}</td>
                          <td className="py-2 pr-4 text-right text-green-500">{formatUsdc(p.amountUsdc)}</td>
                          <td className="py-2 text-right">
                            {p.tierDiscount > 0 ? (
                              <span className="text-orange-400">{p.tierDiscount}%</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DashboardCard>
            </div>
          )}

          {/* ── Empty state ── */}
          {data.totalPayments === 0 && !loading && (
            <DashboardCard className="text-center py-12">
              <DollarSign size={32} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-mono text-muted-foreground mb-1">No x402 payments recorded yet</p>
              <p className="text-xs text-muted-foreground">
                Revenue will appear here as external consumers pay for API access via the x402 protocol.
              </p>
            </DashboardCard>
          )}

          {/* ── Footer info ── */}
          <div className="text-center pb-8">
            <p className="text-[10px] text-muted-foreground font-mono">
              All payments settle in USDC on Base via the x402 protocol · Data refreshes every 30s
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
