import { useState, useEffect, useCallback } from 'react';
import {
  Key, Plus, Trash2, BarChart3, Clock, Activity, Zap,
  Bot, TrendingUp, Eye, EyeOff, AlertTriangle, Shield,
  Copy, Check, ExternalLink,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AppSidebar } from '@/components/AppSidebar';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import TierBadge from '@/components/TierBadge';
import type { ApiKey, UsageMetrics, ApiTier } from '@/types/api';
import { API_TIER_LIMITS } from '@/types/api';
import type { AuditLogEntry } from '@/types/compliance';
import type { NavPage } from '@/components/AppSidebar';

// ---------------------------------------------------------------------------
// Shared UI primitives (matches Dashboard.tsx patterns)
// ---------------------------------------------------------------------------

const StatusBadge = ({ status, label }: { status: 'active' | 'online' | 'live' | 'revoked' | 'warning'; label: string }) => {
  const colors: Record<string, string> = {
    active: 'text-primary',
    online: 'text-primary',
    live: 'text-primary',
    revoked: 'text-destructive',
    warning: 'text-yellow-500',
  };
  const dotColors: Record<string, string> = {
    active: 'bg-primary animate-pulse',
    online: 'bg-primary animate-pulse',
    live: 'bg-primary animate-pulse',
    revoked: 'bg-destructive',
    warning: 'bg-yellow-500 animate-pulse',
  };
  return (
    <span className={`text-xs font-mono ${colors[status] ?? 'text-muted-foreground'} flex items-center gap-1`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[status] ?? 'bg-muted-foreground'}`} />
      {label}
    </span>
  );
};

const DashboardCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-card border border-border rounded-2xl p-4 ${className}`}>
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Mock / demo data generators
// ---------------------------------------------------------------------------

function generateMockApiKeys(): ApiKey[] {
  return [
    {
      id: 'ak_001',
      key: '',
      maskedKey: 'mn_****7f3a',
      name: 'Production Trading Bot',
      tier: 'enterprise' as ApiTier,
      walletAddress: '0x1a2b...9f3e',
      createdAt: '2025-11-12T08:00:00Z',
      lastUsedAt: '2026-02-25T14:32:00Z',
      revokedAt: null,
      isActive: true,
      rateLimitPerMin: 500,
      totalCalls: 1_284_391,
    },
    {
      id: 'ak_002',
      key: '',
      maskedKey: 'mn_****b1c4',
      name: 'Backtest Runner',
      tier: 'professional' as ApiTier,
      walletAddress: '0x1a2b...9f3e',
      createdAt: '2025-12-01T10:30:00Z',
      lastUsedAt: '2026-02-25T12:15:00Z',
      revokedAt: null,
      isActive: true,
      rateLimitPerMin: 120,
      totalCalls: 347_812,
    },
    {
      id: 'ak_003',
      key: '',
      maskedKey: 'mn_****e9d2',
      name: 'Analytics Dashboard',
      tier: 'intelligence' as ApiTier,
      walletAddress: '0x1a2b...9f3e',
      createdAt: '2026-01-15T16:45:00Z',
      lastUsedAt: '2026-02-24T09:00:00Z',
      revokedAt: null,
      isActive: true,
      rateLimitPerMin: 30,
      totalCalls: 8_421,
    },
    {
      id: 'ak_004',
      key: '',
      maskedKey: 'mn_****44ab',
      name: 'Legacy Integration',
      tier: 'intelligence' as ApiTier,
      walletAddress: '0x1a2b...9f3e',
      createdAt: '2025-09-20T11:00:00Z',
      lastUsedAt: '2025-12-10T18:30:00Z',
      revokedAt: '2026-01-05T09:00:00Z',
      isActive: false,
      rateLimitPerMin: 30,
      totalCalls: 52_109,
    },
  ];
}

function generateDailyUsage(): { date: string; calls: number }[] {
  const data: { date: string; calls: number }[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const base = 40000 + Math.floor(Math.random() * 25000);
    const weekday = d.getDay();
    const multiplier = weekday === 0 || weekday === 6 ? 0.6 : 1;
    data.push({
      date: d.toISOString().slice(5, 10),
      calls: Math.round(base * multiplier),
    });
  }
  return data;
}

function generateMockUsageMetrics(): UsageMetrics {
  const dailyUsage = generateDailyUsage();
  return {
    totalCalls: 1_692_733,
    callsToday: 48_291,
    callsThisMonth: 612_447,
    avgLatencyMs: 42,
    errorRate: 0.12,
    topTools: [
      { tool: 'market_analysis', count: 412_891 },
      { tool: 'signal_scan', count: 389_102 },
      { tool: 'portfolio_optimize', count: 298_441 },
      { tool: 'risk_assessment', count: 245_672 },
      { tool: 'whale_tracker', count: 189_003 },
      { tool: 'sentiment_fetch', count: 157_624 },
    ],
    dailyUsage,
  };
}

interface FleetAgent {
  id: string;
  name: string;
  strategy: string;
  status: 'active' | 'paused' | 'stopped';
  pnlUsd: number;
  winRate: number;
  tradeCount: number;
}

function generateMockFleet(): FleetAgent[] {
  return [
    { id: 'ag_001', name: 'Alpha Momentum', strategy: 'momentum', status: 'active', pnlUsd: 12_482.30, winRate: 68.2, tradeCount: 1_247 },
    { id: 'ag_002', name: 'Grid Scalper', strategy: 'grid_trading', status: 'active', pnlUsd: 8_921.15, winRate: 72.1, tradeCount: 3_891 },
    { id: 'ag_003', name: 'Mean Rev ETH', strategy: 'mean_reversion', status: 'active', pnlUsd: 5_340.88, winRate: 61.4, tradeCount: 892 },
    { id: 'ag_004', name: 'Arbitrage Scanner', strategy: 'arbitrage', status: 'paused', pnlUsd: 3_102.45, winRate: 84.7, tradeCount: 2_103 },
    { id: 'ag_005', name: 'DCA Accumulator', strategy: 'dca', status: 'active', pnlUsd: 1_879.20, winRate: 55.3, tradeCount: 312 },
    { id: 'ag_006', name: 'Breakout Hunter', strategy: 'breakout', status: 'stopped', pnlUsd: -420.10, winRate: 42.8, tradeCount: 187 },
  ];
}

function generateMockAuditLog(): AuditLogEntry[] {
  const actions: AuditLogEntry[] = [
    { id: 'al_001', walletAddress: '0x1a2b...9f3e', action: 'api_key_create', severity: 'info', description: 'Created API key "Production Trading Bot"', metadata: { keyName: 'Production Trading Bot', tier: 'enterprise' }, ipAddress: '192.168.1.100', txHash: null, createdAt: '2026-02-25T14:30:00Z' },
    { id: 'al_002', walletAddress: '0x1a2b...9f3e', action: 'agent_deploy', severity: 'info', description: 'Deployed agent "Alpha Momentum" with momentum strategy', metadata: { agentName: 'Alpha Momentum' }, ipAddress: '192.168.1.100', txHash: '0xabc...def', createdAt: '2026-02-25T13:15:00Z' },
    { id: 'al_003', walletAddress: '0x1a2b...9f3e', action: 'trade_execute', severity: 'info', description: 'Agent "Grid Scalper" executed BUY 0.5 ETH @ $2,841.20', metadata: { pair: 'ETH/USDC', side: 'buy' }, ipAddress: null, txHash: '0x123...789', createdAt: '2026-02-25T12:48:00Z' },
    { id: 'al_004', walletAddress: '0x1a2b...9f3e', action: 'agent_pause', severity: 'warning', description: 'Agent "Arbitrage Scanner" paused due to high slippage', metadata: { reason: 'slippage_threshold' }, ipAddress: null, txHash: null, createdAt: '2026-02-25T11:30:00Z' },
    { id: 'al_005', walletAddress: '0x1a2b...9f3e', action: 'portfolio_rebalance', severity: 'info', description: 'Automated portfolio rebalance triggered', metadata: { adjustments: 3 }, ipAddress: null, txHash: '0xdef...456', createdAt: '2026-02-25T10:00:00Z' },
    { id: 'al_006', walletAddress: '0x1a2b...9f3e', action: 'trade_execute', severity: 'info', description: 'Agent "Alpha Momentum" executed SELL 1.2 BTC @ $96,340', metadata: { pair: 'BTC/USDC', side: 'sell' }, ipAddress: null, txHash: '0x456...abc', createdAt: '2026-02-25T09:22:00Z' },
    { id: 'al_007', walletAddress: '0x1a2b...9f3e', action: 'smart_account_update', severity: 'info', description: 'Smart account spending limit updated to 50,000 USDC', metadata: { newLimit: 50000 }, ipAddress: '192.168.1.100', txHash: '0x789...012', createdAt: '2026-02-25T08:45:00Z' },
    { id: 'al_008', walletAddress: '0x1a2b...9f3e', action: 'agent_stop', severity: 'critical', description: 'Agent "Breakout Hunter" stopped: max drawdown exceeded', metadata: { drawdown: -8.4 }, ipAddress: null, txHash: null, createdAt: '2026-02-24T22:10:00Z' },
    { id: 'al_009', walletAddress: '0x1a2b...9f3e', action: 'api_key_revoke', severity: 'warning', description: 'Revoked API key "Legacy Integration"', metadata: { keyName: 'Legacy Integration' }, ipAddress: '192.168.1.100', txHash: null, createdAt: '2026-02-24T20:30:00Z' },
    { id: 'al_010', walletAddress: '0x1a2b...9f3e', action: 'login', severity: 'info', description: 'Wallet connected via MetaMask on Base', metadata: { walletType: 'MetaMask', network: 'Base' }, ipAddress: '192.168.1.100', txHash: null, createdAt: '2026-02-24T18:00:00Z' },
  ];
  return actions;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const ApiTierLabel = ({ tier }: { tier: ApiTier }) => {
  const styles: Record<ApiTier, string> = {
    intelligence: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    professional: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    enterprise: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  };
  return (
    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${styles[tier]}`}>
      {tier.toUpperCase()}
    </span>
  );
};

const SeverityBadge = ({ severity }: { severity: 'info' | 'warning' | 'critical' }) => {
  const styles: Record<string, string> = {
    info: 'text-blue-400 bg-blue-400/10',
    warning: 'text-yellow-400 bg-yellow-400/10',
    critical: 'text-red-400 bg-red-400/10',
  };
  return (
    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${styles[severity]}`}>
      {severity.toUpperCase()}
    </span>
  );
};

const AgentStatusBadge = ({ status }: { status: 'active' | 'paused' | 'stopped' }) => {
  const config: Record<string, { color: string; dotColor: string; label: string }> = {
    active: { color: 'text-primary', dotColor: 'bg-primary animate-pulse', label: 'ACTIVE' },
    paused: { color: 'text-yellow-400', dotColor: 'bg-yellow-400', label: 'PAUSED' },
    stopped: { color: 'text-muted-foreground', dotColor: 'bg-muted-foreground', label: 'STOPPED' },
  };
  const c = config[status];
  return (
    <span className={`text-[10px] font-mono font-bold ${c.color} flex items-center gap-1`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dotColor}`} />
      {c.label}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Custom tooltip for recharts
// ---------------------------------------------------------------------------

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[10px] font-mono text-muted-foreground">{label}</p>
      <p className="text-xs font-mono font-bold text-primary">{payload[0].value.toLocaleString()} calls</p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const InstitutionalDashboard = () => {
  // State
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [fleet, setFleet] = useState<FleetAgent[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate key form state
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyTier, setNewKeyTier] = useState<ApiTier>('intelligence');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Revoke confirmation
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

  // Load mock data
  useEffect(() => {
    const timer = setTimeout(() => {
      setApiKeys(generateMockApiKeys());
      setUsageMetrics(generateMockUsageMetrics());
      setFleet(generateMockFleet());
      setAuditLog(generateMockAuditLog());
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Handlers
  const handleGenerateKey = useCallback(() => {
    if (!newKeyName.trim()) return;
    const randomHex = Math.random().toString(16).slice(2, 6);
    const fullKey = `mn_live_${Math.random().toString(36).slice(2, 14)}${randomHex}`;
    const newKey: ApiKey = {
      id: `ak_${Date.now()}`,
      key: fullKey,
      maskedKey: `mn_****${randomHex}`,
      name: newKeyName.trim(),
      tier: newKeyTier,
      walletAddress: '0x1a2b...9f3e',
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
      isActive: true,
      rateLimitPerMin: API_TIER_LIMITS[newKeyTier].ratePerMin,
      totalCalls: 0,
    };
    setApiKeys(prev => [newKey, ...prev]);
    setGeneratedKey(fullKey);
    setNewKeyName('');
    setNewKeyTier('intelligence');
  }, [newKeyName, newKeyTier]);

  const handleRevokeKey = useCallback((keyId: string) => {
    setApiKeys(prev =>
      prev.map(k =>
        k.id === keyId
          ? { ...k, isActive: false, revokedAt: new Date().toISOString() }
          : k
      )
    );
    setRevokeConfirmId(null);
  }, []);

  const handleCopyKey = useCallback((key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }, []);

  const handleCloseGenerateForm = useCallback(() => {
    setShowGenerateForm(false);
    setGeneratedKey(null);
    setNewKeyName('');
    setNewKeyTier('intelligence');
  }, []);

  // Derived fleet stats
  const activeAgents = fleet.filter(a => a.status === 'active');
  const totalPnl = fleet.reduce((sum, a) => sum + a.pnlUsd, 0);
  const avgWinRate = fleet.length > 0 ? fleet.reduce((sum, a) => sum + a.winRate, 0) / fleet.length : 0;

  // Format helpers
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };
  const formatNumber = (n: number) => n.toLocaleString();
  const formatUsd = (n: number) => {
    const sign = n >= 0 ? '+' : '';
    return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-mono font-bold tracking-wider">MONTRA INSTITUTIONAL</h1>
          <StatusBadge status="live" label="LIVE" />
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
        <AppSidebar activePage={'dashboard' as NavPage} />

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 space-y-6 overflow-x-hidden">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse h-32" />
              ))}
            </div>
          ) : (
            <>
              {/* ============================================================= */}
              {/* SECTION 1: API Key Management                                */}
              {/* ============================================================= */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Key size={14} className="text-primary" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                    API Key Management
                  </span>
                  <div className="h-px flex-1 bg-border" />
                  <button
                    onClick={() => setShowGenerateForm(true)}
                    className="flex items-center gap-1.5 text-xs font-mono text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition"
                  >
                    <Plus size={12} /> Generate New Key
                  </button>
                </div>

                {/* Generate new key form */}
                {showGenerateForm && (
                  <DashboardCard className="mb-4 border-primary/30">
                    {generatedKey ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs font-mono text-primary">
                          <Check size={14} />
                          <span className="font-bold">API Key Generated Successfully</span>
                        </div>
                        <div className="bg-background border border-border rounded-lg p-3 flex items-center gap-2">
                          <code className="text-xs font-mono text-foreground flex-1 break-all">{generatedKey}</code>
                          <button
                            onClick={() => handleCopyKey(generatedKey)}
                            className="text-muted-foreground hover:text-foreground transition p-1"
                          >
                            {copiedKey ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                          </button>
                        </div>
                        <div className="flex items-start gap-2 text-[10px] font-mono text-yellow-400">
                          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                          <span>
                            This key will only be shown once. Copy and store it securely now.
                          </span>
                        </div>
                        <button
                          onClick={handleCloseGenerateForm}
                          className="text-xs font-mono text-muted-foreground hover:text-foreground transition"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-xs font-mono font-bold text-foreground">Generate New API Key</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1.5">
                              Key Name
                            </label>
                            <input
                              type="text"
                              value={newKeyName}
                              onChange={e => setNewKeyName(e.target.value)}
                              placeholder="e.g. Production Bot"
                              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1.5">
                              Tier
                            </label>
                            <select
                              value={newKeyTier}
                              onChange={e => setNewKeyTier(e.target.value as ApiTier)}
                              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary/50 transition"
                            >
                              {(Object.keys(API_TIER_LIMITS) as ApiTier[]).map(tier => (
                                <option key={tier} value={tier}>
                                  {tier.charAt(0).toUpperCase() + tier.slice(1)} &mdash; {API_TIER_LIMITS[tier].priceLabel}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleGenerateKey}
                            disabled={!newKeyName.trim()}
                            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2 hover:bg-primary/80 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Key size={12} /> Generate
                          </button>
                          <button
                            onClick={handleCloseGenerateForm}
                            className="text-xs font-mono text-muted-foreground hover:text-foreground transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </DashboardCard>
                )}

                {/* Existing keys table */}
                <DashboardCard className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="text-[10px] text-muted-foreground uppercase border-b border-border">
                        <th className="text-left pb-2 pr-4">Key</th>
                        <th className="text-left pb-2 pr-4">Name</th>
                        <th className="text-left pb-2 pr-4">Tier</th>
                        <th className="text-left pb-2 pr-4">Status</th>
                        <th className="text-right pb-2 pr-4">Total Calls</th>
                        <th className="text-left pb-2 pr-4">Created</th>
                        <th className="text-right pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {apiKeys.map(key => (
                        <tr key={key.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition">
                          <td className="py-2.5 pr-4">
                            <code className="text-foreground">{key.maskedKey}</code>
                          </td>
                          <td className="py-2.5 pr-4 text-foreground">{key.name}</td>
                          <td className="py-2.5 pr-4">
                            <ApiTierLabel tier={key.tier} />
                          </td>
                          <td className="py-2.5 pr-4">
                            {key.isActive ? (
                              <StatusBadge status="active" label="ACTIVE" />
                            ) : (
                              <StatusBadge status="revoked" label="REVOKED" />
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-foreground">
                            {formatNumber(key.totalCalls)}
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            {formatDate(key.createdAt)}
                          </td>
                          <td className="py-2.5 text-right">
                            {key.isActive && (
                              <>
                                {revokeConfirmId === key.id ? (
                                  <div className="flex items-center gap-2 justify-end">
                                    <span className="text-[10px] text-destructive">Confirm?</span>
                                    <button
                                      onClick={() => handleRevokeKey(key.id)}
                                      className="text-[10px] font-bold text-destructive hover:text-destructive/80 transition"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      onClick={() => setRevokeConfirmId(null)}
                                      className="text-[10px] text-muted-foreground hover:text-foreground transition"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setRevokeConfirmId(key.id)}
                                    className="text-muted-foreground hover:text-destructive transition p-1"
                                    title="Revoke key"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DashboardCard>
              </section>

              {/* ============================================================= */}
              {/* SECTION 2: Usage Metrics                                     */}
              {/* ============================================================= */}
              {usageMetrics && (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <BarChart3 size={14} className="text-primary" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                      Usage Metrics
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {/* Stat cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <DashboardCard>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">Total API Calls</span>
                        <Activity size={10} className="text-primary" />
                      </div>
                      <p className="text-2xl font-mono font-bold">{formatNumber(usageMetrics.totalCalls)}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">All time</p>
                    </DashboardCard>
                    <DashboardCard>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">Calls Today</span>
                        <Zap size={10} className="text-primary" />
                      </div>
                      <p className="text-2xl font-mono font-bold">{formatNumber(usageMetrics.callsToday)}</p>
                      <p className="text-[10px] font-mono text-primary">
                        {((usageMetrics.callsToday / (usageMetrics.callsThisMonth / 25)) * 100 - 100).toFixed(1)}% vs avg
                      </p>
                    </DashboardCard>
                    <DashboardCard>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">This Month</span>
                        <BarChart3 size={10} className="text-primary" />
                      </div>
                      <p className="text-2xl font-mono font-bold">{formatNumber(usageMetrics.callsThisMonth)}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">Feb 2026</p>
                    </DashboardCard>
                    <DashboardCard>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">Avg Latency</span>
                        <Clock size={10} className="text-primary" />
                      </div>
                      <p className="text-2xl font-mono font-bold">{usageMetrics.avgLatencyMs}ms</p>
                      <p className="text-[10px] font-mono text-primary">P99: 128ms</p>
                    </DashboardCard>
                  </div>

                  {/* Charts row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Bar chart */}
                    <DashboardCard className="lg:col-span-2">
                      <p className="text-xs font-mono font-bold mb-3">Daily API Usage (Last 30 Days)</p>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={usageMetrics.dailyUsage} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'hsl(var(--muted-foreground))' }}
                              tickLine={false}
                              axisLine={false}
                              interval={4}
                            />
                            <YAxis
                              tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'hsl(var(--muted-foreground))' }}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                            />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--secondary))' }} />
                            <Bar
                              dataKey="calls"
                              fill="hsl(var(--primary))"
                              radius={[3, 3, 0, 0]}
                              maxBarSize={16}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </DashboardCard>

                    {/* Top tools */}
                    <DashboardCard>
                      <p className="text-xs font-mono font-bold mb-3">Top Tools</p>
                      <div className="space-y-2.5">
                        {usageMetrics.topTools.map((tool, idx) => {
                          const maxCount = usageMetrics.topTools[0].count;
                          const pct = (tool.count / maxCount) * 100;
                          return (
                            <div key={tool.tool}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-mono text-foreground">
                                  {idx + 1}. {tool.tool}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {formatNumber(tool.count)}
                                </span>
                              </div>
                              <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary/70 rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </DashboardCard>
                  </div>
                </section>
              )}

              {/* ============================================================= */}
              {/* SECTION 3: Fleet Overview                                    */}
              {/* ============================================================= */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Bot size={14} className="text-primary" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                    Fleet Overview
                  </span>
                  <div className="h-px flex-1 bg-border" />
                  <a
                    href="/agents"
                    className="flex items-center gap-1 text-[10px] font-mono text-primary hover:text-primary/80 transition"
                  >
                    View Fleet <ExternalLink size={10} />
                  </a>
                </div>

                {/* Fleet stat cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <DashboardCard>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">Total Agents</span>
                      <Bot size={10} className="text-primary" />
                    </div>
                    <p className="text-2xl font-mono font-bold">{fleet.length}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">Deployed</p>
                  </DashboardCard>
                  <DashboardCard>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">Active</span>
                      <Activity size={10} className="text-primary" />
                    </div>
                    <p className="text-2xl font-mono font-bold text-primary">{activeAgents.length}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">Trading now</p>
                  </DashboardCard>
                  <DashboardCard>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">Total P&L</span>
                      <TrendingUp size={10} className={totalPnl >= 0 ? 'text-primary' : 'text-destructive'} />
                    </div>
                    <p className={`text-2xl font-mono font-bold ${totalPnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatUsd(totalPnl)}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">Combined</p>
                  </DashboardCard>
                  <DashboardCard>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">Avg Win Rate</span>
                      <BarChart3 size={10} className="text-primary" />
                    </div>
                    <p className="text-2xl font-mono font-bold">{avgWinRate.toFixed(1)}%</p>
                    <p className="text-[10px] font-mono text-muted-foreground">Across fleet</p>
                  </DashboardCard>
                </div>

                {/* Agents mini table */}
                <DashboardCard className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="text-[10px] text-muted-foreground uppercase border-b border-border">
                        <th className="text-left pb-2 pr-4">Agent</th>
                        <th className="text-left pb-2 pr-4">Strategy</th>
                        <th className="text-left pb-2 pr-4">Status</th>
                        <th className="text-right pb-2 pr-4">P&L</th>
                        <th className="text-right pb-2 pr-4">Win Rate</th>
                        <th className="text-right pb-2">Trades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fleet.map(agent => (
                        <tr key={agent.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition">
                          <td className="py-2.5 pr-4 text-foreground font-bold">{agent.name}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{agent.strategy}</td>
                          <td className="py-2.5 pr-4">
                            <AgentStatusBadge status={agent.status} />
                          </td>
                          <td className={`py-2.5 pr-4 text-right font-bold ${agent.pnlUsd >= 0 ? 'text-primary' : 'text-destructive'}`}>
                            {formatUsd(agent.pnlUsd)}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-foreground">{agent.winRate}%</td>
                          <td className="py-2.5 text-right text-muted-foreground">{formatNumber(agent.tradeCount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DashboardCard>
              </section>

              {/* ============================================================= */}
              {/* SECTION 4: Audit Log Preview                                 */}
              {/* ============================================================= */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Shield size={14} className="text-primary" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                    Audit Log
                  </span>
                  <div className="h-px flex-1 bg-border" />
                  <a
                    href="/compliance"
                    className="flex items-center gap-1 text-[10px] font-mono text-primary hover:text-primary/80 transition"
                  >
                    Full Compliance Log <ExternalLink size={10} />
                  </a>
                </div>

                <DashboardCard className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="text-[10px] text-muted-foreground uppercase border-b border-border">
                        <th className="text-left pb-2 pr-4">Time</th>
                        <th className="text-left pb-2 pr-4">Action</th>
                        <th className="text-left pb-2 pr-4">Severity</th>
                        <th className="text-left pb-2 pr-4">Description</th>
                        <th className="text-left pb-2">Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLog.map(entry => (
                        <tr key={entry.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition">
                          <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                            <div className="leading-tight">
                              <span className="text-foreground">{formatTime(entry.createdAt)}</span>
                              <br />
                              <span className="text-[9px]">{formatDate(entry.createdAt)}</span>
                            </div>
                          </td>
                          <td className="py-2 pr-4 text-foreground whitespace-nowrap">
                            {entry.action.replace(/_/g, ' ')}
                          </td>
                          <td className="py-2 pr-4">
                            <SeverityBadge severity={entry.severity} />
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground max-w-xs truncate">
                            {entry.description}
                          </td>
                          <td className="py-2">
                            {entry.txHash ? (
                              <span className="text-[10px] text-primary cursor-pointer hover:underline" title={entry.txHash}>
                                {entry.txHash.slice(0, 8)}...
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/40">&mdash;</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DashboardCard>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default InstitutionalDashboard;
