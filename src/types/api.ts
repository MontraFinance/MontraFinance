/**
 * Montra Finance — API Type System
 *
 * Type definitions for the institutional REST API layer.
 * Covers API key management, usage metering, and tier-based rate limits.
 */

// ── API Key ─────────────────────────────────────────────────────

export interface ApiKey {
  /** Unique key identifier (public — safe to display in dashboards) */
  id: string;
  /** Human-readable label set by the key owner */
  label: string;
  /** SHA-256 hash of the bearer token (raw token is NEVER stored) */
  keyHash: string;
  /** Truncated prefix shown in UI, e.g. "mf_live_a3b8…" */
  keyPrefix: string;
  /** Wallet address that owns this key */
  ownerAddress: string;
  /** Which API tier this key is provisioned under */
  tier: ApiTier;
  /** ISO-8601 creation timestamp */
  createdAt: string;
  /** ISO-8601 timestamp of last use (null if never used) */
  lastUsedAt: string | null;
  /** Whether the key has been revoked */
  revoked: boolean;
  /** ISO-8601 expiration date (null = no expiry) */
  expiresAt: string | null;
}

// ── Usage Metrics ───────────────────────────────────────────────

export interface UsageMetrics {
  /** API key ID these metrics belong to */
  keyId: string;
  /** Billing period start (ISO-8601) */
  periodStart: string;
  /** Billing period end (ISO-8601) */
  periodEnd: string;
  /** Total requests made in this period */
  totalRequests: number;
  /** Requests that returned a successful response */
  successfulRequests: number;
  /** Requests that were rejected by rate limiting */
  rateLimitedRequests: number;
  /** Breakdown of calls per tool/endpoint */
  callsByTool: Record<string, number>;
  /** Estimated cost in USD for this period */
  estimatedCostUsd: number;
}

// ── API Tiers ───────────────────────────────────────────────────

export type ApiTier = 'intelligence' | 'professional' | 'enterprise';

export interface ApiTierConfig {
  id: ApiTier;
  label: string;
  /** Maximum requests per minute */
  rateLimit: number;
  /** Monthly request quota (null = unlimited) */
  monthlyQuota: number | null;
  /** Monthly base fee in USD (0 = free / pay-per-call only) */
  monthlyFeeUsd: number;
  /** Per-call cost in USD */
  perCallUsd: number;
  /** Short description for display */
  description: string;
}

/**
 * API tier definitions.
 *
 * Intelligence  — Pay-as-you-go, ideal for prototyping & small bots.
 * Professional  — High throughput for production trading systems.
 * Enterprise    — Unlimited access with custom SLA.
 */
export const API_TIER_LIMITS: Record<ApiTier, ApiTierConfig> = {
  intelligence: {
    id: 'intelligence',
    label: 'Intelligence',
    rateLimit: 30,
    monthlyQuota: 10_000,
    monthlyFeeUsd: 0,
    perCallUsd: 0.01,
    description: '30 req/min · 10K/month · $0.01/call',
  },
  professional: {
    id: 'professional',
    label: 'Professional',
    rateLimit: 120,
    monthlyQuota: 100_000,
    monthlyFeeUsd: 499,
    perCallUsd: 0.005,
    description: '120 req/min · 100K/month · $499/mo + $0.005/call',
  },
  enterprise: {
    id: 'enterprise',
    label: 'Enterprise',
    rateLimit: 500,
    monthlyQuota: null,
    monthlyFeeUsd: 0,
    perCallUsd: 0,
    description: '500 req/min · Unlimited · Revenue share on alpha',
  },
};
