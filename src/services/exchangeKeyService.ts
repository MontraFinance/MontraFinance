/**
 * Exchange API Key service — API calls for exchange key CRUD.
 * Pattern: mirrors src/services/agentService.ts
 */
import { fetchWithTimeout } from "@/lib/fetch";

const API_BASE = "/api/exchange-keys";

export interface ExchangeKeyRow {
  id: string;
  exchange: string;
  label: string;
  api_key_masked: string;
  permissions: string[];
  status: string;
  created_at: string;
  last_used_at: string | null;
}

export interface ExchangeKey {
  id: string;
  exchange: string;
  label: string;
  apiKeyMasked: string;
  permissions: string[];
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function mapRowToKey(row: ExchangeKeyRow): ExchangeKey {
  return {
    id: row.id,
    exchange: row.exchange,
    label: row.label,
    apiKeyMasked: row.api_key_masked,
    permissions: row.permissions || [],
    status: row.status,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

export async function addExchangeKeyAPI(
  walletAddress: string,
  exchange: string,
  label: string,
  apiKey: string,
  secret: string,
  passphrase?: string,
  permissions?: string[],
): Promise<ExchangeKey> {
  const resp = await fetchWithTimeout(`${API_BASE}/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress,
      exchange,
      label,
      apiKey,
      secret,
      passphrase: passphrase || undefined,
      permissions: permissions || ["read", "trade"],
    }),
  }, 15_000);

  if (!resp.ok) {
    const json = await resp.json().catch(() => ({ error: "Failed to add key" }));
    throw new Error(json.error || `Add failed: ${resp.status}`);
  }

  const json = await resp.json();
  return mapRowToKey(json.key);
}

export async function listExchangeKeysAPI(walletAddress: string): Promise<ExchangeKey[]> {
  try {
    const resp = await fetchWithTimeout(
      `${API_BASE}/list?wallet=${encodeURIComponent(walletAddress)}`,
    );
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.keys || []).map(mapRowToKey);
  } catch (err) {
    console.warn("[exchangeKeyService] list failed:", err);
    return [];
  }
}

export async function deleteExchangeKeyAPI(
  walletAddress: string,
  keyId: string,
): Promise<void> {
  const resp = await fetchWithTimeout(`${API_BASE}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, keyId }),
  });
  if (!resp.ok) {
    const json = await resp.json().catch(() => ({ error: "Delete failed" }));
    throw new Error(json.error || `Delete failed: ${resp.status}`);
  }
}

export async function testExchangeKeyAPI(
  walletAddress: string,
  keyId: string,
): Promise<{ valid: boolean; error?: string }> {
  const resp = await fetchWithTimeout(`${API_BASE}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, keyId }),
  }, 15_000);

  if (!resp.ok) {
    const json = await resp.json().catch(() => ({ error: "Test failed" }));
    throw new Error(json.error || `Test failed: ${resp.status}`);
  }

  const json = await resp.json();
  return { valid: json.valid, error: json.error };
}
