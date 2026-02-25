/**
 * API key management utilities for the Montra Institutional API.
 * Keys are stored in Supabase `api_keys` table.
 * Format: mn_live_<32 random hex chars>
 */
import { getSupabase } from "./supabase.js";
import crypto from "crypto";

export type ApiTier = "intelligence" | "professional" | "enterprise";

export interface ApiKeyRecord {
  id: string;
  key_hash: string;
  masked_key: string;
  name: string;
  tier: ApiTier;
  wallet_address: string;
  rate_limit_per_min: number;
  monthly_quota: number;
  total_calls: number;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const TIER_LIMITS: Record<ApiTier, { ratePerMin: number; monthlyQuota: number }> = {
  intelligence:  { ratePerMin: 30,  monthlyQuota: 10_000 },
  professional:  { ratePerMin: 120, monthlyQuota: 100_000 },
  enterprise:    { ratePerMin: 500, monthlyQuota: -1 },
};

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function maskKey(key: string): string {
  return key.slice(0, 8) + "****" + key.slice(-4);
}

/** Generate a new API key for a wallet */
export async function generateApiKey(walletAddress: string, name: string, tier: ApiTier): Promise<{ key: string; record: ApiKeyRecord }> {
  const supabase = getSupabase();
  const rawKey = `mn_live_${crypto.randomBytes(16).toString("hex")}`;
  const limits = TIER_LIMITS[tier];

  const record: Omit<ApiKeyRecord, "id" | "created_at"> = {
    key_hash: hashKey(rawKey),
    masked_key: maskKey(rawKey),
    name,
    tier,
    wallet_address: walletAddress.toLowerCase(),
    rate_limit_per_min: limits.ratePerMin,
    monthly_quota: limits.monthlyQuota,
    total_calls: 0,
    is_active: true,
    last_used_at: null,
    revoked_at: null,
  };

  const { data, error } = await supabase.from("api_keys").insert(record).select().single();
  if (error) throw new Error(`Failed to create API key: ${error.message}`);

  return { key: rawKey, record: data as ApiKeyRecord };
}

/** Validate an API key and return the record. Returns null if invalid. */
export async function validateApiKey(key: string): Promise<ApiKeyRecord | null> {
  const supabase = getSupabase();
  const hash = hashKey(key);

  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", hash)
    .eq("is_active", true)
    .is("revoked_at", null)
    .single();

  if (error || !data) return null;

  // Update last_used_at and increment total_calls
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString(), total_calls: (data.total_calls || 0) + 1 })
    .eq("id", data.id);

  return data as ApiKeyRecord;
}

/** List all API keys for a wallet */
export async function listApiKeys(walletAddress: string): Promise<ApiKeyRecord[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list keys: ${error.message}`);
  return (data || []) as ApiKeyRecord[];
}

/** Revoke an API key */
export async function revokeApiKey(keyId: string, walletAddress: string): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("wallet_address", walletAddress.toLowerCase());

  return !error;
}
