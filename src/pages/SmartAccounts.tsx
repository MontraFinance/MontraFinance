import { useState } from 'react';
import {
  Shield, Key, Gauge, Blocks, Plus, Pencil, Trash2, Copy, Check,
  Lock, Users, Timer, DollarSign, AlertTriangle, ChevronDown,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import TierBadge from '@/components/TierBadge';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import type {
  SmartAccountConfig,
  SmartAccountStatus,
  SessionKey,
  SessionPermission,
  SpendingLimit,
  SmartAccountModule,
  GuardrailConfig,
} from '@/types/smartAccount';

// ---------------------------------------------------------------------------
// Local components
// ---------------------------------------------------------------------------

const StatusBadge = ({ status, label }: { status: string; label: string }) => {
  const colors: Record<string, string> = {
    active: 'text-primary',
    online: 'text-primary',
    live: 'text-primary',
    pending: 'text-amber-500',
    locked: 'text-red-500',
    frozen: 'text-blue-400',
  };
  const dotColors: Record<string, string> = {
    active: 'bg-primary',
    online: 'bg-primary',
    live: 'bg-primary',
    pending: 'bg-amber-500',
    locked: 'bg-red-500',
    frozen: 'bg-blue-400',
  };
  return (
    <span className={`text-xs font-mono ${colors[status] ?? 'text-primary'} flex items-center gap-1`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[status] ?? 'bg-primary'} animate-pulse`} />
      {label}
    </span>
  );
};

const DashboardCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-card border border-border rounded-2xl p-4 ${className}`}>
    {children}
  </div>
);

const SectionHeader = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children?: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-primary" />
      <h2 className="text-xs font-mono font-bold uppercase tracking-wider">{title}</h2>
    </div>
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Permission badge colours
// ---------------------------------------------------------------------------

const PERM_COLORS: Record<SessionPermission, string> = {
  trade_execute: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  trade_cancel: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  portfolio_rebalance: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  agent_manage: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  view_only: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const MODULE_TYPE_COLORS: Record<SmartAccountModule['type'], string> = {
  validator: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  executor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  hook: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  fallback: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

const ACCOUNT_STATUS_STYLE: Record<SmartAccountStatus, { label: string; color: string }> = {
  active: { label: 'ACTIVE', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  pending: { label: 'PENDING', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  locked: { label: 'LOCKED', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  frozen: { label: 'FROZEN', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr || '\u2014';
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}

function formatUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatMs(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(0)}m`;
  return `${(ms / 1_000).toFixed(0)}s`;
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const DEMO_SPENDING_LIMITS: SpendingLimit[] = [
  { token: 'USDC', dailyLimit: 500_000, weeklyLimit: 2_000_000, perTxLimit: 100_000, usedToday: 127_450, usedThisWeek: 843_200 },
  { token: 'WETH', dailyLimit: 200, weeklyLimit: 800, perTxLimit: 50, usedToday: 34.2, usedThisWeek: 156.8 },
  { token: 'WBTC', dailyLimit: 10, weeklyLimit: 40, perTxLimit: 2, usedToday: 1.4, usedThisWeek: 7.2 },
  { token: 'MONTRA', dailyLimit: 5_000_000, weeklyLimit: 20_000_000, perTxLimit: 1_000_000, usedToday: 890_000, usedThisWeek: 4_200_000 },
];

const DEMO_SESSION_KEYS: SessionKey[] = [
  {
    id: 'sk-1',
    label: 'Trading Bot Alpha',
    publicKey: '0x04a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
    permissions: ['trade_execute', 'trade_cancel'],
    expiresAt: '2026-04-15T00:00:00Z',
    createdAt: '2026-01-10T14:30:00Z',
    isActive: true,
  },
  {
    id: 'sk-2',
    label: 'Portfolio Rebalancer',
    publicKey: '0x04f1e2d3c4b5a6978899a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1',
    permissions: ['portfolio_rebalance', 'view_only'],
    expiresAt: '2026-06-01T00:00:00Z',
    createdAt: '2026-02-01T09:00:00Z',
    isActive: true,
  },
  {
    id: 'sk-3',
    label: 'Read-Only Auditor',
    publicKey: '0x04b9a8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9',
    permissions: ['view_only'],
    expiresAt: '2026-03-01T00:00:00Z',
    createdAt: '2025-12-20T18:45:00Z',
    isActive: false,
  },
];

const DEMO_MODULES: SmartAccountModule[] = [
  { id: 'mod-1', name: 'ECDSA Validator', type: 'validator', address: '0x7579Ee8307284FccE4742c1de4dAb0477C95Ea09', isEnabled: true, config: {} },
  { id: 'mod-2', name: 'Session Key Executor', type: 'executor', address: '0x7579Ab3209c4EBc123456789012345678901234a', isEnabled: true, config: {} },
  { id: 'mod-3', name: 'Spending Limit Hook', type: 'hook', address: '0x7579Cd5678901234567890abcdef1234567890bc', isEnabled: true, config: {} },
  { id: 'mod-4', name: 'Token Recovery Fallback', type: 'fallback', address: '0x7579Ef9012345678901234567890abcdef123456', isEnabled: false, config: {} },
  { id: 'mod-5', name: 'Timelock Executor', type: 'executor', address: '0x7579Aa1234567890abcdef1234567890abcdef12', isEnabled: true, config: {} },
];

const DEMO_GUARDRAILS: GuardrailConfig = {
  maxSingleTradeUsd: 250_000,
  maxDailyVolumeUsd: 2_000_000,
  allowedTokens: ['USDC', 'WETH', 'WBTC', 'MONTRA', 'DAI', 'USDT', 'ARB', 'OP'],
  blockedProtocols: [],
  requireMultiSigAbove: 100_000,
  cooldownBetweenTradesMs: 30_000,
};

const DEMO_CONFIG: SmartAccountConfig = {
  id: 'sa-001',
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  smartAccountAddress: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
  status: 'active',
  requiredSignatures: 2,
  signers: [
    '0x1234567890abcdef1234567890abcdef12345678',
    '0xAA11BB22CC33DD44EE55FF6677889900AABBCCDD',
    '0x9988776655443322110099887766554433221100',
  ],
  spendingLimits: DEMO_SPENDING_LIMITS,
  sessionKeys: DEMO_SESSION_KEYS,
  modules: DEMO_MODULES,
  createdAt: '2025-11-15T10:00:00Z',
  updatedAt: '2026-02-20T16:45:00Z',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const SmartAccounts = () => {
  const [config] = useState<SmartAccountConfig>(DEMO_CONFIG);
  const [guardrails] = useState<GuardrailConfig>(DEMO_GUARDRAILS);
  const [modules, setModules] = useState<SmartAccountModule[]>(DEMO_MODULES);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [expandedGuardrails, setExpandedGuardrails] = useState(true);

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 1500);
  };

  const toggleModule = (moduleId: string) => {
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, isEnabled: !m.isEnabled } : m)),
    );
  };

  const accountStatus = ACCOUNT_STATUS_STYLE[config.status];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-mono font-bold tracking-wider">
            SMART ACCOUNTS <span className="text-muted-foreground">&middot;</span> ERC-7579
          </h1>
          <StatusBadge status={config.status} label={accountStatus.label} />
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
        <main className="flex-1 p-4 md:p-6 space-y-6">

          {/* ----------------------------------------------------------------
              1. ACCOUNT OVERVIEW
          ---------------------------------------------------------------- */}
          <DashboardCard>
            <SectionHeader icon={Shield} title="Account Overview">
              <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${accountStatus.color}`}>
                {accountStatus.label}
              </span>
            </SectionHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Smart Account Address */}
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Smart Account</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-mono font-bold text-primary">
                    {truncateAddress(config.smartAccountAddress)}
                  </p>
                  <button
                    onClick={() => handleCopy(config.smartAccountAddress)}
                    className="text-muted-foreground hover:text-foreground transition"
                    title="Copy address"
                  >
                    {copiedAddr === config.smartAccountAddress ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              {/* Owner EOA */}
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Owner EOA</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-mono font-bold">
                    {truncateAddress(config.walletAddress)}
                  </p>
                  <button
                    onClick={() => handleCopy(config.walletAddress)}
                    className="text-muted-foreground hover:text-foreground transition"
                    title="Copy address"
                  >
                    {copiedAddr === config.walletAddress ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              {/* Required Signatures */}
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Required Signatures</p>
                <p className="text-sm font-mono font-bold">
                  {config.requiredSignatures} <span className="text-muted-foreground font-normal">of</span> {config.signers.length}
                </p>
              </div>

              {/* Modules */}
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Active Modules</p>
                <p className="text-sm font-mono font-bold text-primary">
                  {modules.filter((m) => m.isEnabled).length}
                  <span className="text-muted-foreground font-normal"> / {modules.length}</span>
                </p>
              </div>
            </div>

            {/* Authorized Signers */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-[10px] font-mono text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                <Users size={10} /> Authorized Signers
              </p>
              <div className="flex flex-wrap gap-2">
                {config.signers.map((signer, i) => (
                  <button
                    key={signer}
                    onClick={() => handleCopy(signer)}
                    className="inline-flex items-center gap-1.5 text-[10px] font-mono bg-secondary/50 border border-border rounded-lg px-2.5 py-1.5 hover:bg-secondary transition group"
                    title={signer}
                  >
                    <Lock size={9} className="text-muted-foreground" />
                    <span className="text-foreground">{truncateAddress(signer)}</span>
                    {i === 0 && (
                      <span className="text-[8px] text-primary font-bold ml-1">OWNER</span>
                    )}
                    {copiedAddr === signer ? (
                      <Check size={9} className="text-emerald-400" />
                    ) : (
                      <Copy size={9} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </DashboardCard>

          {/* ----------------------------------------------------------------
              2. SPENDING LIMITS
          ---------------------------------------------------------------- */}
          <DashboardCard>
            <SectionHeader icon={DollarSign} title="Spending Limits">
              <button className="flex items-center gap-1.5 text-[10px] font-mono text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition">
                <Plus size={10} /> Add Limit
              </button>
            </SectionHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-border text-[10px] text-muted-foreground uppercase">
                    <th className="text-left px-4 py-3 font-medium">Token</th>
                    <th className="text-right px-4 py-3 font-medium">Daily Limit</th>
                    <th className="text-right px-4 py-3 font-medium">Weekly Limit</th>
                    <th className="text-right px-4 py-3 font-medium">Per-Tx Limit</th>
                    <th className="text-right px-4 py-3 font-medium">Used Today</th>
                    <th className="text-right px-4 py-3 font-medium">Used This Week</th>
                    <th className="text-center px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {config.spendingLimits.map((limit) => {
                    const dailyPct = Math.min(100, (limit.usedToday / limit.dailyLimit) * 100);
                    const weeklyPct = Math.min(100, (limit.usedThisWeek / limit.weeklyLimit) * 100);
                    const dailyWarn = dailyPct > 80;
                    const weeklyWarn = weeklyPct > 80;
                    return (
                      <tr key={limit.token} className="border-b border-border/50 hover:bg-secondary/30 transition">
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-foreground">{limit.token}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-right text-muted-foreground">
                          {limit.dailyLimit.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-right text-muted-foreground">
                          {limit.weeklyLimit.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-right text-muted-foreground">
                          {limit.perTxLimit.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={`text-xs font-bold ${dailyWarn ? 'text-amber-400' : 'text-foreground'}`}>
                              {limit.usedToday.toLocaleString()}
                            </span>
                            <div className="w-16 h-1 bg-secondary rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${dailyWarn ? 'bg-amber-400' : 'bg-primary'}`}
                                style={{ width: `${dailyPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={`text-xs font-bold ${weeklyWarn ? 'text-amber-400' : 'text-foreground'}`}>
                              {limit.usedThisWeek.toLocaleString()}
                            </span>
                            <div className="w-16 h-1 bg-secondary rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${weeklyWarn ? 'bg-amber-400' : 'bg-primary'}`}
                                style={{ width: `${weeklyPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition"
                            title="Edit limit"
                          >
                            <Pencil size={10} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DashboardCard>

          {/* ----------------------------------------------------------------
              3. SESSION KEYS
          ---------------------------------------------------------------- */}
          <DashboardCard>
            <SectionHeader icon={Key} title="Session Keys">
              <button className="flex items-center gap-1.5 text-[10px] font-mono text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition">
                <Plus size={10} /> Create Session Key
              </button>
            </SectionHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-border text-[10px] text-muted-foreground uppercase">
                    <th className="text-left px-4 py-3 font-medium">Label</th>
                    <th className="text-left px-4 py-3 font-medium">Public Key</th>
                    <th className="text-left px-4 py-3 font-medium">Permissions</th>
                    <th className="text-left px-4 py-3 font-medium">Expires</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-center px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {config.sessionKeys.map((sk) => {
                    const expired = new Date(sk.expiresAt) < new Date();
                    const isLive = sk.isActive && !expired;
                    return (
                      <tr key={sk.id} className="border-b border-border/50 hover:bg-secondary/30 transition">
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-foreground">{sk.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">{truncateAddress(sk.publicKey)}</span>
                            <button
                              onClick={() => handleCopy(sk.publicKey)}
                              className="text-muted-foreground hover:text-foreground transition"
                            >
                              {copiedAddr === sk.publicKey ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {sk.permissions.map((perm) => (
                              <span
                                key={perm}
                                className={`inline-flex text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${PERM_COLORS[perm]}`}
                              >
                                {perm.replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${expired ? 'text-red-400' : 'text-muted-foreground'}`}>
                            {new Date(sk.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            {expired && (
                              <span className="ml-1 text-[9px] text-red-400 font-bold">EXPIRED</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${
                              isLive
                                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                                : 'text-red-400 bg-red-500/10 border-red-500/30'
                            }`}
                          >
                            {isLive ? 'ACTIVE' : expired ? 'EXPIRED' : 'REVOKED'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isLive && (
                            <button
                              className="inline-flex items-center gap-1 text-[10px] font-mono text-red-400 hover:text-red-300 transition"
                              title="Revoke session key"
                            >
                              <Trash2 size={10} /> Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DashboardCard>

          {/* ----------------------------------------------------------------
              4. GUARDRAILS
          ---------------------------------------------------------------- */}
          <DashboardCard>
            <button
              onClick={() => setExpandedGuardrails(!expandedGuardrails)}
              className="w-full"
            >
              <SectionHeader icon={Gauge} title="Guardrails">
                <ChevronDown
                  size={14}
                  className={`text-muted-foreground transition-transform ${expandedGuardrails ? 'rotate-180' : ''}`}
                />
              </SectionHeader>
            </button>

            {expandedGuardrails && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-2">
                {/* Max Single Trade */}
                <div className="bg-secondary/30 border border-border rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={10} className="text-amber-400" />
                    <p className="text-[10px] font-mono text-muted-foreground uppercase">Max Single Trade</p>
                  </div>
                  <p className="text-lg font-mono font-bold text-foreground">{formatUsd(guardrails.maxSingleTradeUsd)}</p>
                </div>

                {/* Max Daily Volume */}
                <div className="bg-secondary/30 border border-border rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <DollarSign size={10} className="text-primary" />
                    <p className="text-[10px] font-mono text-muted-foreground uppercase">Max Daily Volume</p>
                  </div>
                  <p className="text-lg font-mono font-bold text-foreground">{formatUsd(guardrails.maxDailyVolumeUsd)}</p>
                </div>

                {/* Multi-sig Threshold */}
                <div className="bg-secondary/30 border border-border rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users size={10} className="text-purple-400" />
                    <p className="text-[10px] font-mono text-muted-foreground uppercase">Multi-Sig Above</p>
                  </div>
                  <p className="text-lg font-mono font-bold text-foreground">{formatUsd(guardrails.requireMultiSigAbove)}</p>
                </div>

                {/* Cooldown */}
                <div className="bg-secondary/30 border border-border rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Timer size={10} className="text-blue-400" />
                    <p className="text-[10px] font-mono text-muted-foreground uppercase">Cooldown Between Trades</p>
                  </div>
                  <p className="text-lg font-mono font-bold text-foreground">{formatMs(guardrails.cooldownBetweenTradesMs)}</p>
                </div>

                {/* Allowed Tokens */}
                <div className="bg-secondary/30 border border-border rounded-xl p-3 md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Shield size={10} className="text-emerald-400" />
                      <p className="text-[10px] font-mono text-muted-foreground uppercase">Allowed Tokens</p>
                    </div>
                    <button className="text-[10px] font-mono text-primary hover:text-primary/80 transition flex items-center gap-1">
                      <Pencil size={9} /> Edit
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {guardrails.allowedTokens.map((token) => (
                      <Badge
                        key={token}
                        variant="outline"
                        className="text-[10px] font-mono font-bold border-border text-foreground hover:bg-secondary/50"
                      >
                        {token}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DashboardCard>

          {/* ----------------------------------------------------------------
              5. MODULES (ERC-7579)
          ---------------------------------------------------------------- */}
          <DashboardCard>
            <SectionHeader icon={Blocks} title="Installed Modules">
              <span className="text-[10px] font-mono text-muted-foreground">
                ERC-7579 Module Registry
              </span>
            </SectionHeader>

            <div className="space-y-2">
              {modules.map((mod) => (
                <div
                  key={mod.id}
                  className={`flex items-center justify-between bg-secondary/20 border border-border rounded-xl px-4 py-3 transition ${
                    mod.isEnabled ? '' : 'opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Blocks size={14} className={mod.isEnabled ? 'text-primary' : 'text-muted-foreground'} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-mono font-bold text-foreground truncate">{mod.name}</p>
                        <span className={`inline-flex text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${MODULE_TYPE_COLORS[mod.type]}`}>
                          {mod.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-mono text-muted-foreground">{truncateAddress(mod.address)}</span>
                        <button
                          onClick={() => handleCopy(mod.address)}
                          className="text-muted-foreground hover:text-foreground transition"
                        >
                          {copiedAddr === mod.address ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                    <span className={`text-[9px] font-mono ${mod.isEnabled ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {mod.isEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                    <Switch
                      checked={mod.isEnabled}
                      onCheckedChange={() => toggleModule(mod.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>

        </main>
      </div>
    </div>
  );
};

export default SmartAccounts;
