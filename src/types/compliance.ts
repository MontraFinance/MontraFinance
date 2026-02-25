/**
 * Montra Finance — Compliance & Audit Type System
 *
 * Type definitions for audit logging, compliance reporting,
 * and regulatory trail generation.
 */

// ── Audit Severity ──────────────────────────────────────────────

export type AuditSeverity = 'info' | 'warning' | 'critical';

// ── Audit Actions (17 trackable actions) ────────────────────────

export type AuditAction =
  | 'api_key.created'
  | 'api_key.revoked'
  | 'api_key.rotated'
  | 'api_key.accessed'
  | 'api_call.executed'
  | 'api_call.rate_limited'
  | 'api_call.unauthorized'
  | 'agent.launched'
  | 'agent.stopped'
  | 'agent.config_changed'
  | 'trade.submitted'
  | 'trade.executed'
  | 'trade.failed'
  | 'wallet.connected'
  | 'wallet.disconnected'
  | 'compliance.report_generated'
  | 'compliance.export_requested';

// ── Audit Log Entry ─────────────────────────────────────────────

export interface AuditLogEntry {
  /** Unique log entry identifier */
  id: string;
  /** ISO-8601 timestamp of the event */
  timestamp: string;
  /** The action that was performed */
  action: AuditAction;
  /** Severity classification */
  severity: AuditSeverity;
  /** Wallet address of the actor (null for system events) */
  actorAddress: string | null;
  /** API key ID involved (null if not key-related) */
  apiKeyId: string | null;
  /** Human-readable description of the event */
  description: string;
  /** Arbitrary metadata attached to the event */
  metadata: Record<string, unknown>;
  /** IP address of the request origin (masked for privacy) */
  ipAddress: string | null;
  /** User-agent string (truncated) */
  userAgent: string | null;
}

// ── Compliance Report ───────────────────────────────────────────

export interface ComplianceReport {
  /** Unique report identifier */
  id: string;
  /** ISO-8601 generation timestamp */
  generatedAt: string;
  /** Wallet address of the requester */
  requestedBy: string;
  /** Report period start (ISO-8601) */
  periodStart: string;
  /** Report period end (ISO-8601) */
  periodEnd: string;
  /** Total audit events in the period */
  totalEvents: number;
  /** Breakdown by severity */
  severityCounts: Record<AuditSeverity, number>;
  /** Breakdown by action type */
  actionCounts: Partial<Record<AuditAction, number>>;
  /** Flagged entries requiring attention */
  flaggedEntries: AuditLogEntry[];
  /** Report format (for export) */
  format: 'json' | 'csv';
}

// ── Filter helpers (for UI) ─────────────────────────────────────

export interface AuditFilter {
  /** Filter by action types */
  actions?: AuditAction[];
  /** Filter by severity levels */
  severities?: AuditSeverity[];
  /** Filter by date range start (ISO-8601) */
  from?: string;
  /** Filter by date range end (ISO-8601) */
  to?: string;
  /** Filter by actor wallet address */
  actorAddress?: string;
  /** Filter by API key ID */
  apiKeyId?: string;
  /** Full-text search on description */
  search?: string;
}

/** Severity display config for UI badges */
export const SEVERITY_CONFIG: Record<
  AuditSeverity,
  { label: string; color: string; bgColor: string }
> = {
  info: {
    label: 'Info',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  warning: {
    label: 'Warning',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
  },
  critical: {
    label: 'Critical',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
  },
};
