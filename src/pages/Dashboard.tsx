import { useRef, useState, useEffect, memo } from 'react';
import {
  Cpu, Database, Signal, Clock, Activity, Zap,
  Globe, Brain, Server, Thermometer, HardDrive,
} from 'lucide-react';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import TierBadge from '@/components/TierBadge';
import CommandCenter from '@/components/CommandCenter';
import type { CommandCenterHandle } from '@/components/CommandCenter';
import SentimentWidget from '@/components/SentimentWidget';
import { AppSidebar } from '@/components/AppSidebar';
import { useTelemetry } from '@/hooks/useTelemetry';
import { GPU_CONFIG, CPU_CONFIG, AI_MODELS, MCP_CONFIG, DB_CONFIG } from '@/config/platform';

const StatusBadge = ({ status, label }: { status: 'active' | 'online' | 'live'; label: string }) => {
  const colors = {
    active: 'text-primary',
    online: 'text-primary',
    live: 'text-primary',
  };
  return (
    <span className={`text-xs font-mono ${colors[status]} flex items-center gap-1`}>
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      {label}
    </span>
  );
};

const DashboardCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-card border border-border rounded-2xl p-4 ${className}`}>
    {children}
  </div>
);

const ProgressBar = ({ value, max = 100 }: { value: number; max?: number }) => (
  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
    <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${(value / max) * 100}%` }} />
  </div>
);

const LatencyChart = memo(({ points }: { points: number[] }) => {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const h = 60;
  const w = 200;
  const range = max - min || 1;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
      <defs>
        <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="url(#latencyGrad)" />
      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" className="transition-all duration-700" />
    </svg>
  );
});

const ThroughputChart = memo(({ bars }: { bars: number[] }) => {
  const max = Math.max(...bars);
  return (
    <div className="flex items-end gap-1 h-16">
      {bars.map((val, i) => (
        <div
          key={i}
          className="flex-1 bg-primary/70 rounded-sm min-w-[4px] transition-all duration-700"
          style={{ height: `${(val / max) * 100}%` }}
        />
      ))}
    </div>
  );
});

const ACTION_QUERIES: Record<string, string> = {
  'Market Analysis': 'Give me a full market analysis on BTC right now. What are the key levels, whale activity, and overall sentiment?',
  'Risk Assessment': 'What are the biggest risks in the crypto market right now? Analyze BTC and ETH risk factors.',
  'Signal Detection': 'What trading signals are firing right now? Scan BTC and ETH for the strongest setups.',
  'Portfolio Review': 'I have a $10K portfolio split between BTC and ETH. Should I rebalance? Give me the full analysis.',
};

const ACTIVITY_POOL = [
  'Risk Management',
  'Whale Tracking',
  'Monte Carlo Sim',
  'Signal Detection',
  'Portfolio Rebalance',
  'Liquidity Scan',
  'Derivatives Hedge',
  'Volatility Forecast',
  'Order Flow Scan',
  'Sentiment Sweep',
  'Funding Rate Arb',
  'Correlation Matrix',
  'Smart Money Track',
  'Options Pricing',
  'Drawdown Analysis',
];

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function generateActivity() {
  const now = new Date();
  const pool = [...ACTIVITY_POOL].sort(() => Math.random() - 0.5);
  return Array.from({ length: 4 }, (_, i) => ({
    label: pool[i],
    time: formatTime(new Date(now.getTime() - i * (15000 + Math.random() * 45000))),
  }));
}

function useRecentActivity(intervalMs = 8000) {
  const [items, setItems] = useState(generateActivity);
  useEffect(() => {
    const id = setInterval(() => {
      setItems(prev => {
        const pool = ACTIVITY_POOL.filter(a => a !== prev[0]?.label);
        const next = pool[Math.floor(Math.random() * pool.length)];
        return [{ label: next, time: formatTime(new Date()) }, ...prev.slice(0, 3)];
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return items;
}

const Dashboard = () => {
  const terminalRef = useRef<CommandCenterHandle>(null);
  const t = useTelemetry(2000);
  const recentActivity = useRecentActivity(8000);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-mono font-bold tracking-wider">MONTRA TERMINAL</h1>
          <StatusBadge status="live" label="LIVE" />
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className="hidden md:inline">
            CPU <span className="text-primary">{t.headerCpu}%</span> GPU×{GPU_CONFIG.count} <span className="text-primary">{t.headerGpu}%</span> VRAM <span className="text-primary">{t.headerRam}%</span> vLLM <span className="text-primary">{t.headerOct}%</span>
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
        <AppSidebar activePage="dashboard" />

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left column */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* GPU Cluster — Vast.ai 4x RTX 5090 */}
            <DashboardCard>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Server size={14} className="text-primary" />
                  <div>
                    <p className="text-xs font-mono font-bold">GPU CLUSTER</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{GPU_CONFIG.label}</p>
                  </div>
                </div>
                <StatusBadge status="live" label="LIVE" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-muted-foreground">
                <div>
                  <p className="mb-1">UTILIZATION</p>
                  <p className="text-sm text-primary font-bold">{t.gpuUtil}%</p>
                  <ProgressBar value={t.gpuUtil} />
                </div>
                <div>
                  <p className="mb-1">TEMPERATURE</p>
                  <p className="text-sm text-foreground font-bold">{t.gpuTemp}°C</p>
                </div>
                <div>
                  <p className="mb-1">VRAM</p>
                  <p className="text-sm text-primary font-bold">{t.gpuMem}%</p>
                  <ProgressBar value={t.gpuMem} />
                </div>
                <div>
                  <p className="mb-1">POWER</p>
                  <p className="text-sm text-foreground font-bold">{t.gpuPower}W</p>
                </div>
              </div>
              {/* Per-GPU breakdown */}
              <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                {Array.from({ length: GPU_CONFIG.count }, (_, i) => i).map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <HardDrive size={10} className="text-muted-foreground" />
                    <span className="text-[9px] font-mono text-muted-foreground w-12">GPU {i}</span>
                    <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(40, t.gpuUtil + (i * 3 - 4))}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-primary w-8 text-right">
                      {Math.max(40, t.gpuUtil + (i * 3 - 4))}%
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                <span>{GPU_CONFIG.provider} · ssh:{GPU_CONFIG.sshPort}</span>
                <span className="text-primary">vLLM · TP={GPU_CONFIG.tensorParallel}</span>
              </div>
            </DashboardCard>

            {/* Database */}
            <DashboardCard>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Database size={14} className="text-primary" />
                  <div>
                    <p className="text-xs font-mono font-bold">DATABASE</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{DB_CONFIG.engine}</p>
                  </div>
                </div>
                <StatusBadge status="active" label="ACTIVE" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-muted-foreground">
                <div>
                  <p className="mb-1">UPTIME</p>
                  <p className="text-sm text-foreground font-bold">{t.dbUptime}%</p>
                </div>
                <div>
                  <p className="mb-1">QUERIES/SEC</p>
                  <p className="text-sm text-foreground font-bold">{t.dbQps.toLocaleString()}</p>
                </div>
                <div>
                  <p className="mb-1">STORAGE</p>
                  <p className="text-sm text-foreground font-bold">{t.dbStorage} TB</p>
                </div>
                <div>
                  <p className="mb-1">LATENCY</p>
                  <p className="text-sm text-primary font-bold">{t.dbLatency}ms</p>
                </div>
              </div>
            </DashboardCard>

            {/* Signal Proc */}
            <DashboardCard>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Signal size={14} className="text-primary" />
                  <div>
                    <p className="text-xs font-mono font-bold">SIGNAL PROC.</p>
                    <p className="text-[10px] text-muted-foreground font-mono">Pipeline Status</p>
                  </div>
                </div>
                <StatusBadge status="active" label="ACTIVE" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-muted-foreground">
                <div>
                  <p className="mb-1">SIGNAL/SEC</p>
                  <p className="text-sm text-foreground font-bold">{t.sigSpeed}ms</p>
                </div>
                <div>
                  <p className="mb-1">THROUGHPUT</p>
                  <p className="text-sm text-foreground font-bold">{t.sigThroughput.toLocaleString()}/s</p>
                </div>
                <div>
                  <p className="mb-1">ACCURACY</p>
                  <p className="text-sm text-primary font-bold">{t.sigAccuracy}%</p>
                </div>
                <div>
                  <p className="mb-1">STATUS</p>
                  <p className="text-sm text-primary font-bold">Active</p>
                </div>
              </div>
            </DashboardCard>

            {/* Latency */}
            <DashboardCard>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-mono font-bold uppercase">Latency History</p>
                <span className="text-xs font-mono text-primary">{t.currentLatency}ms</span>
              </div>
              <LatencyChart points={t.latencyHistory} />
            </DashboardCard>
          </div>

          {/* Center column - Terminal */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {/* Main AI Terminal */}
            <CommandCenter ref={terminalRef} />

            {/* Bottom stats */}
            <div className="grid grid-cols-3 gap-4">
              <DashboardCard>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Total Tasks</span>
                  <Zap size={10} className="text-primary" />
                </div>
                <p className="text-2xl font-mono font-bold">{t.totalTasks.toLocaleString()}</p>
                <p className="text-[10px] font-mono text-muted-foreground">All-time processed</p>
              </DashboardCard>
              <DashboardCard>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Active Tasks</span>
                  <Activity size={10} className="text-primary" />
                </div>
                <p className="text-2xl font-mono font-bold">{t.activeTasks}</p>
                <p className="text-[10px] font-mono text-muted-foreground">Currently processing</p>
              </DashboardCard>
              <DashboardCard>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Recent Activity</span>
                  <Clock size={10} className="text-primary" />
                </div>
                <div className="space-y-1 mt-1">
                  {recentActivity.slice(0, 3).map((item) => (
                    <p key={item.label} className="text-[10px] font-mono text-muted-foreground">
                      <span className="text-foreground">{item.time}</span> {item.label}
                    </p>
                  ))}
                </div>
              </DashboardCard>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-2">
              {['Market Analysis', 'Risk Assessment', 'Signal Detection', 'Portfolio Review'].map(label => (
                <button
                  key={label}
                  onClick={() => terminalRef.current?.submitQuery(ACTION_QUERIES[label])}
                  className="text-xs font-mono text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:text-foreground hover:bg-secondary hover:border-primary/30 transition"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* CPU */}
            <DashboardCard>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu size={14} className="text-primary" />
                  <div>
                    <p className="text-xs font-mono font-bold">CPU</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{CPU_CONFIG.model}</p>
                  </div>
                </div>
                <StatusBadge status="active" label="ACTIVE" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-muted-foreground">
                <div>
                  <p className="mb-1">UTILIZATION</p>
                  <p className="text-sm text-primary font-bold">{t.cpuUtil}%</p>
                </div>
                <div>
                  <p className="mb-1">TEMPERATURE</p>
                  <p className="text-sm text-foreground font-bold">{t.cpuTemp}°C</p>
                </div>
                <div>
                  <p className="mb-1">CORES</p>
                  <p className="text-sm text-foreground font-bold">{CPU_CONFIG.cores}</p>
                </div>
                <div>
                  <p className="mb-1">THREADS</p>
                  <p className="text-sm text-foreground font-bold">{CPU_CONFIG.threads}</p>
                </div>
              </div>
            </DashboardCard>

            {/* Exchange */}
            <DashboardCard>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-primary" />
                  <p className="text-xs font-mono font-bold">EXCHANGE</p>
                </div>
                <StatusBadge status="active" label="ACTIVE" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-muted-foreground">
                <div>
                  <p className="mb-1">API/LATENCY</p>
                  <p className="text-sm text-primary font-bold">{t.exLatency}ms</p>
                </div>
                <div>
                  <p className="mb-1">UPTIME</p>
                  <p className="text-sm text-foreground font-bold">{t.exUptime}%</p>
                </div>
                <div>
                  <p className="mb-1">ORDER RATE</p>
                  <p className="text-sm text-foreground font-bold">{t.exOrderRate}/s</p>
                </div>
                <div>
                  <p className="mb-1">FILL RATE</p>
                  <p className="text-sm text-primary font-bold">{t.exFillRate}%</p>
                </div>
              </div>
            </DashboardCard>

            {/* AI Models */}
            <DashboardCard>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-mono font-bold uppercase">AI Models</p>
                <StatusBadge status="online" label="ONLINE" />
              </div>
              <div className="space-y-3">
                {AI_MODELS.map((m, idx) => {
                  const icons = [Brain, Globe, Signal];
                  const Icon = icons[idx] || Signal;
                  const value = m.metricKey ? `${t[m.metricKey]}${m.unit}` : (m.staticValue ?? 'Active');
                  return { icon: Icon, name: m.name, sub: m.sub, label: m.metricLabel, value, color: 'text-primary' };
                }).map(({ icon: Icon, name, sub, label, value, color }) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={12} className="text-primary" />
                      <div>
                        <p className="text-[10px] font-mono font-bold">{name}</p>
                        <p className="text-[9px] font-mono text-muted-foreground">{sub}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-mono text-muted-foreground">{label}</p>
                      <p className={`text-xs font-mono font-bold ${color}`}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardCard>

            {/* Throughput */}
            <DashboardCard>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-mono font-bold uppercase">Throughput</p>
                <span className="text-xs font-mono text-primary">{t.currentThroughput}ms</span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground mb-2">Job Batching</p>
              <ThroughputChart bars={t.throughputHistory} />
            </DashboardCard>

            {/* Farcaster Sentiment */}
            <SentimentWidget />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
