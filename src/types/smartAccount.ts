/**
 * Montra Finance — Smart Account Type System
 *
 * Type definitions for ERC-7579 modular smart account configuration,
 * session keys, spending limits, and guardrail policies.
 */

// ── Smart Account Modules ───────────────────────────────────────

export type SmartAccountModule =
  | 'session-keys'
  | 'spending-limits'
  | 'guardrails'
  | 'recovery'
  | 'multicall'
  | 'automation';

export interface ModuleConfig {
  /** Module identifier */
  module: SmartAccountModule;
  /** Whether the module is currently enabled */
  enabled: boolean;
  /** ISO-8601 timestamp when the module was installed */
  installedAt: string;
  /** Module-specific configuration (varies per module) */
  settings: Record<string, unknown>;
}

// ── Session Keys ────────────────────────────────────────────────

export interface SessionKey {
  /** Unique session key identifier */
  id: string;
  /** Human-readable label for the session */
  label: string;
  /** The delegated signer address for this session */
  signerAddress: string;
  /** Permissions granted to this session key */
  permissions: SessionPermission[];
  /** ISO-8601 timestamp when the session becomes valid */
  validAfter: string;
  /** ISO-8601 timestamp when the session expires */
  validUntil: string;
  /** Whether the session key has been revoked */
  revoked: boolean;
  /** ISO-8601 creation timestamp */
  createdAt: string;
  /** Number of transactions executed with this key */
  usageCount: number;
}

export interface SessionPermission {
  /** Target contract address this permission applies to */
  target: string;
  /** Allowed function selectors (4-byte hex, e.g. "0xa9059cbb") */
  functionSelectors: string[];
  /** Maximum ETH value per transaction (in wei, as string) */
  maxValuePerTx: string;
  /** Maximum number of calls allowed (null = unlimited) */
  maxCalls: number | null;
}

// ── Spending Limits ─────────────────────────────────────────────

export type SpendingPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface SpendingLimit {
  /** Unique limit identifier */
  id: string;
  /** Token address this limit applies to (null = native ETH) */
  tokenAddress: string | null;
  /** Token symbol for display */
  tokenSymbol: string;
  /** Maximum amount per period (token units, as string for precision) */
  maxAmount: string;
  /** Amount already spent in the current period */
  spentAmount: string;
  /** Reset period */
  period: SpendingPeriod;
  /** ISO-8601 timestamp when the current period resets */
  periodResetsAt: string;
  /** Whether this limit is currently active */
  enabled: boolean;
}

// ── Guardrails ──────────────────────────────────────────────────

export type GuardrailType =
  | 'whitelist'
  | 'blacklist'
  | 'max-gas'
  | 'time-lock'
  | 'amount-threshold';

export interface GuardrailConfig {
  /** Unique guardrail identifier */
  id: string;
  /** Type of guardrail policy */
  type: GuardrailType;
  /** Human-readable label */
  label: string;
  /** Whether this guardrail is active */
  enabled: boolean;
  /** Guardrail-specific parameters */
  params: GuardrailParams;
  /** ISO-8601 creation timestamp */
  createdAt: string;
}

export type GuardrailParams =
  | WhitelistParams
  | BlacklistParams
  | MaxGasParams
  | TimeLockParams
  | AmountThresholdParams;

export interface WhitelistParams {
  type: 'whitelist';
  /** Addresses allowed to receive transactions */
  addresses: string[];
}

export interface BlacklistParams {
  type: 'blacklist';
  /** Addresses blocked from receiving transactions */
  addresses: string[];
}

export interface MaxGasParams {
  type: 'max-gas';
  /** Maximum gas price in gwei */
  maxGasGwei: number;
}

export interface TimeLockParams {
  type: 'time-lock';
  /** Delay in seconds before high-value transactions execute */
  delaySec: number;
  /** Threshold amount (in USD) that triggers the time lock */
  thresholdUsd: number;
}

export interface AmountThresholdParams {
  type: 'amount-threshold';
  /** Maximum single-transaction amount in USD */
  maxAmountUsd: number;
  /** Require multi-sig above this USD amount (null = disabled) */
  multiSigAboveUsd: number | null;
}

// ── Smart Account Config (top-level) ────────────────────────────

export interface SmartAccountConfig {
  /** Smart account contract address */
  accountAddress: string;
  /** Owner wallet address */
  ownerAddress: string;
  /** ERC-7579 implementation standard */
  standard: 'ERC-7579';
  /** Chain ID the account is deployed on */
  chainId: number;
  /** Installed modules */
  modules: ModuleConfig[];
  /** Active session keys */
  sessionKeys: SessionKey[];
  /** Configured spending limits */
  spendingLimits: SpendingLimit[];
  /** Active guardrail policies */
  guardrails: GuardrailConfig[];
  /** ISO-8601 account creation timestamp */
  createdAt: string;
}
