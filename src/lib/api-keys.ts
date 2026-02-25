/**
 * Montra Finance — API Key Management
 *
 * Handles generation, validation, revocation, and tier-based limits
 * for institutional API keys. Keys are SHA-256 hashed before storage;
 * raw tokens are returned exactly once at creation time.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { ApiKey, ApiTier, ApiTierConfig } from '../types/api.js';
import { API_TIER_LIMITS } from '../types/api.js';

// ── Key generation ──────────────────────────────────────────────

const KEY_PREFIX = 'mf_live_';
const KEY_BYTE_LENGTH = 32;

/**
 * Generate a cryptographically secure API key.
 * Returns the raw bearer token (shown once) and its SHA-256 hash (stored).
 */
export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const token = randomBytes(KEY_BYTE_LENGTH).toString('hex');
  const rawKey = `${KEY_PREFIX}${token}`;
  const keyHash = hashKey(rawKey);
  const keyPrefix = `${KEY_PREFIX}${token.slice(0, 8)}…`;

  return { rawKey, keyHash, keyPrefix };
}

/**
 * Hash a raw API key with SHA-256.
 * This is the only form that should ever be persisted.
 */
export function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

// ── Key validation ──────────────────────────────────────────────

/**
 * Validate the format of a raw API key.
 * Does NOT check against the database — use `verifyKey` for full auth.
 */
export function isValidKeyFormat(rawKey: string): boolean {
  if (!rawKey.startsWith(KEY_PREFIX)) return false;
  // prefix + 64 hex chars
  const token = rawKey.slice(KEY_PREFIX.length);
  return /^[a-f0-9]{64}$/.test(token);
}

/**
 * Extract the bearer token from an Authorization header.
 * Expects: "Bearer mf_live_..."
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  const token = parts[1];
  return isValidKeyFormat(token) ? token : null;
}

// ── Tier enforcement ────────────────────────────────────────────

/**
 * Get the tier configuration for a given API key record.
 */
export function getTierConfig(tier: ApiTier): ApiTierConfig {
  return API_TIER_LIMITS[tier];
}

/**
 * Check whether a key has exceeded its monthly quota.
 */
export function isQuotaExceeded(tier: ApiTier, currentUsage: number): boolean {
  const config = API_TIER_LIMITS[tier];
  if (config.monthlyQuota === null) return false; // unlimited
  return currentUsage >= config.monthlyQuota;
}

/**
 * Check whether a key has been revoked or is expired.
 */
export function isKeyActive(key: Pick<ApiKey, 'revoked' | 'expiresAt'>): boolean {
  if (key.revoked) return false;
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return false;
  return true;
}

// ── Response helpers ────────────────────────────────────────────

/**
 * Build a safe, redacted API key object for client responses.
 * Strips the keyHash — clients should never see it.
 */
export function redactKeyForResponse(
  key: ApiKey
): Omit<ApiKey, 'keyHash'> & { tierConfig: ApiTierConfig } {
  const { keyHash: _hash, ...safe } = key;
  return {
    ...safe,
    tierConfig: API_TIER_LIMITS[key.tier],
  };
}
