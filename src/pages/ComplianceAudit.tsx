import { useState, useMemo } from 'react';
import {
  Shield, FileText, Download, Search, Filter, ChevronLeft, ChevronRight,
  AlertTriangle, AlertCircle, Info, Clock, ExternalLink, FileDown,
  Activity, Eye,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import TierBadge from '@/components/TierBadge';
import type {
  AuditLogEntry,
  ComplianceReport,
  AuditAction,
  AuditSeverity,
} from '@/types/compliance';

// ---------------------------------------------------------------------------
// Reusable components (same patterns as Dashboard.tsx)
// ---------------------------------------------------------------------------

const StatusBadge = ({ status, label }: { status: 'active' | 'online' | 'live'; label: string }) => {
  const colors = { active: 'text-primary', online: 'text-primary', live: 'text-primary' };
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

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG: Record<AuditSeverity, { label: string; color: string; bgColor: string; borderColor: string; icon: typeof Info }> = {
  info: {
    label: 'INFO',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon: Info,
  },
  warning: {
    label: 'WARNING',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    icon: AlertTriangle,
  },
  critical: {
    label: 'CRITICAL',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon: AlertCircle,
  },
};

const SEVERITY_DOT: Record<AuditSeverity, string> = {
  info: 'bg-blue-400',
  warning: 'bg-yellow-400',
  critical: 'bg-red-400',
};

// ---------------------------------------------------------------------------
// Action label mapping
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<AuditAction, string> = {
  agent_deploy: 'Agent Deploy',
  agent_pause: 'Agent Pause',
  agent_stop: 'Agent Stop',
  agent_delete: 'Agent Delete',
  trade_execute: 'Trade Execute',
  trade_cancel: 'Trade Cancel',
  portfolio_rebalance: 'Portfolio Rebalance',
  burn_submit: 'Burn Submit',
  burn_complete: 'Burn Complete',
  api_key_create: 'API Key Create',
  api_key_revoke: 'API Key Revoke',
  smart_account_create: 'Smart Account Create',
  smart_account_update: 'Smart Account Update',
  alert_create: 'Alert Create',
  alert_delete: 'Alert Delete',
  login: 'Login',
  settings_change: 'Settings Change',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateHash(hash: string): string {
  if (!hash || hash.length < 12) return hash || '\u2014';
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
}

function formatShortTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Demo / placeholder data
// ---------------------------------------------------------------------------

const DEMO_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'audit-001',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'agent_deploy',
    severity: 'info',
    description: 'Agent "Alpha Scalper" deployed to production with BTC/USDT pair configuration.',
    metadata: { agentId: 'agent-001', pair: 'BTC/USDT' },
    ipAddress: '192.168.1.42',
    txHash: '0xabc123def456789012345678901234567890abcdef1234567890abcdef123456',
    createdAt: '2026-02-25T14:32:10Z',
  },
  {
    id: 'audit-002',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'trade_execute',
    severity: 'info',
    description: 'Market buy order executed: 0.5 BTC at $97,420.00 via Binance.',
    metadata: { orderId: 'ord-5521', exchange: 'binance' },
    ipAddress: '192.168.1.42',
    txHash: '0xdef789abc012345678901234567890abcdef1234567890abcdef12345678abcd',
    createdAt: '2026-02-25T14:28:45Z',
  },
  {
    id: 'audit-003',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'burn_submit',
    severity: 'info',
    description: 'Token burn submitted: 1,500 $MONTRA for AI terminal query access.',
    metadata: { burnAmount: 1500 },
    ipAddress: '192.168.1.42',
    txHash: '0x456789abcdef012345678901234567890abcdef1234567890abcdef12345678',
    createdAt: '2026-02-25T14:15:22Z',
  },
  {
    id: 'audit-004',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'api_key_revoke',
    severity: 'warning',
    description: 'API key "prod-key-03" revoked due to suspicious activity detection.',
    metadata: { keyId: 'prod-key-03', reason: 'suspicious_activity' },
    ipAddress: '10.0.0.15',
    txHash: null,
    createdAt: '2026-02-25T13:55:00Z',
  },
  {
    id: 'audit-005',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'agent_stop',
    severity: 'critical',
    description: 'Agent "Delta Arb" emergency stopped: max drawdown threshold breached (-8.2%).',
    metadata: { agentId: 'agent-004', drawdown: -8.2 },
    ipAddress: '192.168.1.42',
    txHash: '0x789012abcdef345678901234567890abcdef1234567890abcdef123456789012',
    createdAt: '2026-02-25T13:42:18Z',
  },
  {
    id: 'audit-006',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'trade_execute',
    severity: 'info',
    description: 'Limit sell order filled: 2.0 ETH at $3,285.50 via Coinbase.',
    metadata: { orderId: 'ord-5518', exchange: 'coinbase' },
    ipAddress: '192.168.1.42',
    txHash: '0xabcdef123456789012345678901234567890abcdef1234567890abcdef123456',
    createdAt: '2026-02-25T13:30:05Z',
  },
  {
    id: 'audit-007',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'smart_account_update',
    severity: 'warning',
    description: 'Smart account spending limit increased from $50,000 to $100,000 per day.',
    metadata: { oldLimit: 50000, newLimit: 100000 },
    ipAddress: '10.0.0.15',
    txHash: '0x345678abcdef901234567890abcdef1234567890abcdef1234567890abcdef12',
    createdAt: '2026-02-25T12:58:30Z',
  },
  {
    id: 'audit-008',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'login',
    severity: 'info',
    description: 'Wallet connected via MetaMask from new IP address.',
    metadata: { provider: 'metamask' },
    ipAddress: '203.0.113.42',
    txHash: null,
    createdAt: '2026-02-25T12:45:00Z',
  },
  {
    id: 'audit-009',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'portfolio_rebalance',
    severity: 'info',
    description: 'Automated portfolio rebalance executed: shifted 15% allocation from BTC to ETH.',
    metadata: { fromAsset: 'BTC', toAsset: 'ETH', percentage: 15 },
    ipAddress: '192.168.1.42',
    txHash: '0x901234abcdef567890123456789abcdef01234567890abcdef1234567890abcd',
    createdAt: '2026-02-25T12:20:15Z',
  },
  {
    id: 'audit-010',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'agent_deploy',
    severity: 'critical',
    description: 'Agent "Gamma Grid" deployment failed: insufficient gas on Base network.',
    metadata: { agentId: 'agent-007', error: 'INSUFFICIENT_GAS' },
    ipAddress: '192.168.1.42',
    txHash: null,
    createdAt: '2026-02-25T11:55:42Z',
  },
  {
    id: 'audit-011',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'burn_complete',
    severity: 'info',
    description: 'Burn confirmed on-chain: 800 $MONTRA burned for standard query.',
    metadata: { burnAmount: 800 },
    ipAddress: '192.168.1.42',
    txHash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    createdAt: '2026-02-25T11:40:00Z',
  },
  {
    id: 'audit-012',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'settings_change',
    severity: 'warning',
    description: 'Risk tolerance changed from "moderate" to "aggressive" for all active agents.',
    metadata: { oldValue: 'moderate', newValue: 'aggressive' },
    ipAddress: '192.168.1.42',
    txHash: null,
    createdAt: '2026-02-25T11:22:30Z',
  },
  {
    id: 'audit-013',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'trade_cancel',
    severity: 'info',
    description: 'Pending limit order cancelled: 1.0 BTC sell at $102,000.',
    metadata: { orderId: 'ord-5510' },
    ipAddress: '192.168.1.42',
    txHash: null,
    createdAt: '2026-02-25T10:58:15Z',
  },
  {
    id: 'audit-014',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'api_key_create',
    severity: 'warning',
    description: 'New API key "prod-key-04" generated with full trading permissions.',
    metadata: { keyId: 'prod-key-04', permissions: ['trade', 'read', 'withdraw'] },
    ipAddress: '192.168.1.42',
    txHash: null,
    createdAt: '2026-02-25T10:30:00Z',
  },
  {
    id: 'audit-015',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'agent_pause',
    severity: 'warning',
    description: 'Agent "Beta Trend" paused: approaching daily loss limit ($4,200 / $5,000).',
    metadata: { agentId: 'agent-002', currentLoss: 4200, limit: 5000 },
    ipAddress: '192.168.1.42',
    txHash: null,
    createdAt: '2026-02-25T10:10:45Z',
  },
  {
    id: 'audit-016',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'smart_account_create',
    severity: 'info',
    description: 'New smart account created on Base network with multi-sig (2/3) configuration.',
    metadata: { network: 'base', signers: 3, threshold: 2 },
    ipAddress: '192.168.1.42',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    createdAt: '2026-02-25T09:45:00Z',
  },
  {
    id: 'audit-017',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'trade_execute',
    severity: 'critical',
    description: 'Large trade detected: 10 BTC market sell triggered circuit breaker.',
    metadata: { orderId: 'ord-5505', size: '10 BTC', type: 'circuit_breaker' },
    ipAddress: '192.168.1.42',
    txHash: '0xabcd1234ef567890abcd1234ef567890abcd1234ef567890abcd1234ef567890',
    createdAt: '2026-02-25T09:12:30Z',
  },
  {
    id: 'audit-018',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'alert_create',
    severity: 'info',
    description: 'Price alert set: BTC < $90,000 notification via webhook.',
    metadata: { asset: 'BTC', condition: 'below', threshold: 90000 },
    ipAddress: '192.168.1.42',
    txHash: null,
    createdAt: '2026-02-25T08:50:10Z',
  },
  {
    id: 'audit-019',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'agent_delete',
    severity: 'warning',
    description: 'Agent "Epsilon Sniper" permanently deleted. All associated data purged.',
    metadata: { agentId: 'agent-009' },
    ipAddress: '192.168.1.42',
    txHash: null,
    createdAt: '2026-02-25T08:30:00Z',
  },
  {
    id: 'audit-020',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    action: 'login',
    severity: 'critical',
    description: 'Failed login attempt from unrecognized IP. Geo-location: unknown VPN node.',
    metadata: { provider: 'walletconnect', status: 'failed' },
    ipAddress: '198.51.100.99',
    txHash: null,
    createdAt: '2026-02-25T08:05:20Z',
  },
];

const DEMO_COMPLIANCE_REPORTS: ComplianceReport[] = [
  {
    id: 'rpt-001',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    reportType: 'full',
    periodStart: '2026-01-01T00:00:00Z',
    periodEnd: '2026-01-31T23:59:59Z',
    generatedAt: '2026-02-01T08:00:00Z',
    totalTransactions: 342,
    totalVolume: 2845000,
    pnl: 45200,
    status: 'ready',
    downloadUrl: '#',
  },
  {
    id: 'rpt-002',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    reportType: 'tax',
    periodStart: '2025-01-01T00:00:00Z',
    periodEnd: '2025-12-31T23:59:59Z',
    generatedAt: '2026-01-15T10:30:00Z',
    totalTransactions: 4128,
    totalVolume: 18950000,
    pnl: 312500,
    status: 'ready',
    downloadUrl: '#',
  },
  {
    id: 'rpt-003',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    reportType: 'risk',
    periodStart: '2026-02-01T00:00:00Z',
    periodEnd: '2026-02-25T23:59:59Z',
    generatedAt: '2026-02-25T06:00:00Z',
    totalTransactions: 89,
    totalVolume: 620000,
    pnl: -8400,
    status: 'ready',
    downloadUrl: '#',
  },
  {
    id: 'rpt-004',
    walletAddress: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12',
    reportType: 'activity',
    periodStart: '2026-02-18T00:00:00Z',
    periodEnd: '2026-02-25T23:59:59Z',
    generatedAt: '2026-02-25T14:00:00Z',
    totalTransactions: 28,
    totalVolume: 185000,
    pnl: 3200,
    status: 'generating',
    downloadUrl: null,
  },
];

const REPORT_TYPE_LABELS: Record<ComplianceReport['reportType'], string> = {
  activity: 'Activity Report',
  tax: 'Tax Report',
  risk: 'Risk Assessment',
  full: 'Full Compliance',
};

const BASE_EXPLORER = 'https://basescan.org/tx/';
const PAGE_SIZE = 8;

// ---------------------------------------------------------------------------
// Severity badge sub-component
// ---------------------------------------------------------------------------

const SeverityBadge = ({ severity }: { severity: AuditSeverity }) => {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${cfg.color} ${cfg.bgColor} ${cfg.borderColor}`}
    >
      <cfg.icon size={10} />
      {cfg.label}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

const ComplianceAudit = () => {
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditAction | ''>('');
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    startDate: '',
    endDate: '',
    action: '' as AuditAction | '',
    severity: '' as AuditSeverity | '',
    search: '',
  });

  // Pagination
  const [page, setPage] = useState(0);

  // Report generation form
  const [reportType, setReportType] = useState<ComplianceReport['reportType']>('full');
  const [reportStart, setReportStart] = useState('');
  const [reportEnd, setReportEnd] = useState('');

  // Apply filters
  const handleApplyFilters = () => {
    setAppliedFilters({
      startDate,
      endDate,
      action: actionFilter,
      severity: severityFilter,
      search: searchQuery,
    });
    setPage(0);
  };

  // Filtered audit logs
  const filteredLogs = useMemo(() => {
    return DEMO_AUDIT_LOGS.filter((entry) => {
      if (appliedFilters.action && entry.action !== appliedFilters.action) return false;
      if (appliedFilters.severity && entry.severity !== appliedFilters.severity) return false;
      if (appliedFilters.startDate) {
        const start = new Date(appliedFilters.startDate);
        if (new Date(entry.createdAt) < start) return false;
      }
      if (appliedFilters.endDate) {
        const end = new Date(appliedFilters.endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(entry.createdAt) > end) return false;
      }
      if (appliedFilters.search) {
        const q = appliedFilters.search.toLowerCase();
        const searchable = `${entry.description} ${entry.action} ${entry.txHash || ''} ${entry.ipAddress || ''}`.toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [appliedFilters]);

  // Paginated logs
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginatedLogs = filteredLogs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Summary counts
  const summaryTotal = filteredLogs.length;
  const summaryCritical = filteredLogs.filter((e) => e.severity === 'critical').length;
  const summaryWarning = filteredLogs.filter((e) => e.severity === 'warning').length;
  const summaryInfo = filteredLogs.filter((e) => e.severity === 'info').length;

  // Timeline: last 20 events (from full list, not filtered)
  const timelineEvents = DEMO_AUDIT_LOGS.slice(0, 20);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-mono font-bold tracking-wider">COMPLIANCE & AUDIT TRAIL</h1>
          <StatusBadge status="live" label="MONITORING" />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:text-foreground hover:bg-secondary hover:border-primary/30 transition">
              <Download size={10} />
              CSV
            </button>
            <button className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:text-foreground hover:bg-secondary hover:border-primary/30 transition">
              <FileText size={10} />
              PDF
            </button>
          </div>
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
        <main className="flex-1 p-4 md:p-6 grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Primary content area */}
          <div className="xl:col-span-9 flex flex-col gap-4">
            {/* Filters bar */}
            <DashboardCard>
              <div className="flex items-center gap-2 mb-3">
                <Filter size={14} className="text-primary" />
                <p className="text-xs font-mono font-bold uppercase">Filters</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                {/* Start date */}
                <div>
                  <label className="text-[9px] font-mono text-muted-foreground uppercase block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                {/* End date */}
                <div>
                  <label className="text-[9px] font-mono text-muted-foreground uppercase block mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                {/* Action type */}
                <div>
                  <label className="text-[9px] font-mono text-muted-foreground uppercase block mb-1">Action Type</label>
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value as AuditAction | '')}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">All Actions</option>
                    {(Object.keys(ACTION_LABELS) as AuditAction[]).map((action) => (
                      <option key={action} value={action}>{ACTION_LABELS[action]}</option>
                    ))}
                  </select>
                </div>
                {/* Severity */}
                <div>
                  <label className="text-[9px] font-mono text-muted-foreground uppercase block mb-1">Severity</label>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value as AuditSeverity | '')}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">All Severities</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                {/* Search */}
                <div>
                  <label className="text-[9px] font-mono text-muted-foreground uppercase block mb-1">Search</label>
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                      className="w-full h-8 rounded-md border border-input bg-background pl-7 pr-2 py-1 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                </div>
                {/* Apply button */}
                <div className="flex items-end">
                  <button
                    onClick={handleApplyFilters}
                    className="w-full h-8 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg hover:bg-primary/80 transition flex items-center justify-center gap-1.5"
                  >
                    <Filter size={10} />
                    APPLY FILTERS
                  </button>
                </div>
              </div>
            </DashboardCard>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <DashboardCard>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Total Events</span>
                  <Activity size={12} className="text-primary" />
                </div>
                <p className="text-2xl font-mono font-bold">{summaryTotal}</p>
                <div className="mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[9px] font-mono text-muted-foreground">all severity levels</span>
                </div>
              </DashboardCard>

              <DashboardCard>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Critical</span>
                  <AlertCircle size={12} className="text-red-400" />
                </div>
                <p className="text-2xl font-mono font-bold text-red-400">{summaryCritical}</p>
                <div className="mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-[9px] font-mono text-muted-foreground">require attention</span>
                </div>
              </DashboardCard>

              <DashboardCard>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Warnings</span>
                  <AlertTriangle size={12} className="text-yellow-400" />
                </div>
                <p className="text-2xl font-mono font-bold text-yellow-400">{summaryWarning}</p>
                <div className="mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="text-[9px] font-mono text-muted-foreground">advisory notices</span>
                </div>
              </DashboardCard>

              <DashboardCard>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Info</span>
                  <Info size={12} className="text-blue-400" />
                </div>
                <p className="text-2xl font-mono font-bold text-blue-400">{summaryInfo}</p>
                <div className="mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-[9px] font-mono text-muted-foreground">standard activity</span>
                </div>
              </DashboardCard>
            </div>

            {/* Audit log table */}
            <DashboardCard className="overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-primary" />
                  <p className="text-xs font-mono font-bold uppercase">Audit Log</p>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {filteredLogs.length} event{filteredLogs.length !== 1 ? 's' : ''} found
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="border-b border-border text-[10px] text-muted-foreground uppercase">
                      <th className="text-left px-3 py-2.5 font-medium">Timestamp</th>
                      <th className="text-left px-3 py-2.5 font-medium">Action</th>
                      <th className="text-center px-3 py-2.5 font-medium">Severity</th>
                      <th className="text-left px-3 py-2.5 font-medium">Description</th>
                      <th className="text-right px-3 py-2.5 font-medium">TX Hash</th>
                      <th className="text-right px-3 py-2.5 font-medium">IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-12 text-center">
                          <Eye size={28} className="text-muted-foreground/30 mx-auto mb-2" />
                          <p className="text-xs font-mono text-muted-foreground">No audit events match your filters.</p>
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map((entry) => (
                        <tr key={entry.id} className="border-b border-border/50 hover:bg-secondary/30 transition">
                          <td className="px-3 py-2.5 text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatTimestamp(entry.createdAt)}
                          </td>
                          <td className="px-3 py-2.5 text-[10px] text-foreground whitespace-nowrap font-semibold">
                            {ACTION_LABELS[entry.action]}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <SeverityBadge severity={entry.severity} />
                          </td>
                          <td className="px-3 py-2.5 text-[10px] text-muted-foreground max-w-[280px] truncate" title={entry.description}>
                            {entry.description}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            {entry.txHash ? (
                              <a
                                href={`${BASE_EXPLORER}${entry.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 hover:underline transition"
                              >
                                {truncateHash(entry.txHash)}
                                <ExternalLink size={9} />
                              </a>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">{'\u2014'}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-[10px] text-muted-foreground whitespace-nowrap">
                            {entry.ipAddress || '\u2014'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredLogs.length > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:text-foreground hover:bg-secondary transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={10} />
                      PREV
                    </button>
                    <button
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                      className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:text-foreground hover:bg-secondary transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      NEXT
                      <ChevronRight size={10} />
                    </button>
                  </div>
                </div>
              )}
            </DashboardCard>

            {/* Compliance reports section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Generate report form */}
              <DashboardCard>
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={14} className="text-primary" />
                  <p className="text-xs font-mono font-bold uppercase">Generate Report</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-mono text-muted-foreground uppercase block mb-1">Report Type</label>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value as ComplianceReport['reportType'])}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="full">Full Compliance Report</option>
                      <option value="activity">Activity Report</option>
                      <option value="tax">Tax Report</option>
                      <option value="risk">Risk Assessment</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-mono text-muted-foreground uppercase block mb-1">Period Start</label>
                      <input
                        type="date"
                        value={reportStart}
                        onChange={(e) => setReportStart(e.target.value)}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-muted-foreground uppercase block mb-1">Period End</label>
                      <input
                        type="date"
                        value={reportEnd}
                        onChange={(e) => setReportEnd(e.target.value)}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                    </div>
                  </div>
                  <button className="w-full h-9 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg hover:bg-primary/80 transition flex items-center justify-center gap-1.5">
                    <FileText size={12} />
                    GENERATE REPORT
                  </button>
                </div>
              </DashboardCard>

              {/* Existing reports table */}
              <DashboardCard>
                <div className="flex items-center gap-2 mb-4">
                  <FileDown size={14} className="text-primary" />
                  <p className="text-xs font-mono font-bold uppercase">Existing Reports</p>
                </div>
                <div className="space-y-2">
                  {DEMO_COMPLIANCE_REPORTS.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 hover:bg-secondary/20 transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[10px] font-mono font-bold text-foreground truncate">
                            {REPORT_TYPE_LABELS[report.reportType]}
                          </p>
                          {report.status === 'ready' ? (
                            <span className="text-[8px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">
                              READY
                            </span>
                          ) : report.status === 'generating' ? (
                            <span className="text-[8px] font-mono font-semibold text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded px-1.5 py-0.5 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-yellow-400 animate-pulse" />
                              GENERATING
                            </span>
                          ) : (
                            <span className="text-[8px] font-mono font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded px-1.5 py-0.5">
                              ERROR
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] font-mono text-muted-foreground">
                          {new Date(report.periodStart).toLocaleDateString()} {'\u2014'} {new Date(report.periodEnd).toLocaleDateString()}
                          {' \u00B7 '}
                          {report.totalTransactions} txns
                          {' \u00B7 '}
                          ${(report.totalVolume / 1000).toFixed(0)}K vol
                          {' \u00B7 '}
                          <span className={report.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {report.pnl >= 0 ? '+' : ''}${report.pnl.toLocaleString()}
                          </span>
                        </p>
                      </div>
                      <button
                        disabled={report.status !== 'ready'}
                        className="ml-3 inline-flex items-center gap-1 text-[9px] font-mono font-bold text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 hover:text-foreground hover:bg-secondary transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Download size={9} />
                        DL
                      </button>
                    </div>
                  ))}
                </div>
              </DashboardCard>
            </div>
          </div>

          {/* Right sidebar: Activity Timeline */}
          <div className="xl:col-span-3 flex flex-col gap-4">
            <DashboardCard>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-primary" />
                  <p className="text-xs font-mono font-bold uppercase">Activity Timeline</p>
                </div>
                <span className="text-[9px] font-mono text-muted-foreground">Last 20 events</span>
              </div>
              <div className="space-y-0">
                {timelineEvents.map((event, idx) => {
                  const isLast = idx === timelineEvents.length - 1;
                  return (
                    <div key={event.id} className="flex gap-3">
                      {/* Timeline connector */}
                      <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${SEVERITY_DOT[event.severity]}`} />
                        {!isLast && (
                          <div className="w-px flex-1 bg-border min-h-[24px]" />
                        )}
                      </div>
                      {/* Content */}
                      <div className={`pb-3 flex-1 min-w-0 ${isLast ? '' : ''}`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[9px] font-mono font-bold text-foreground">
                            {ACTION_LABELS[event.action]}
                          </span>
                          <span className={`text-[8px] font-mono font-semibold ${SEVERITY_CONFIG[event.severity].color}`}>
                            {SEVERITY_CONFIG[event.severity].label}
                          </span>
                        </div>
                        <p className="text-[9px] font-mono text-muted-foreground leading-relaxed truncate" title={event.description}>
                          {event.description}
                        </p>
                        <span className="text-[8px] font-mono text-muted-foreground/60 mt-0.5 block">
                          {formatShortTime(event.createdAt)}
                          {event.ipAddress ? ` \u00B7 ${event.ipAddress}` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DashboardCard>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ComplianceAudit;
