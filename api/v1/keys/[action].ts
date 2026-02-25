/**
 * API Key Management — /api/v1/keys/{generate|list|revoke}
 * Requires wallet authentication via X-Wallet-Address header.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCorsHeaders } from "../../_lib/cors.js";
import { checkRateLimit } from "../../_lib/rate-limit.js";
import { generateApiKey, listApiKeys, revokeApiKey, type ApiTier } from "../../_lib/api-keys.js";
import { logAudit } from "../../_lib/audit.js";

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const VALID_TIERS: ApiTier[] = ["intelligence", "professional", "enterprise"];

function getWallet(req: VercelRequest): string | null {
  const wallet = req.headers["x-wallet-address"] as string;
  return wallet && WALLET_RE.test(wallet) ? wallet : null;
}

async function handleGenerate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const wallet = getWallet(req);
  if (!wallet) return res.status(401).json({ error: "Missing or invalid X-Wallet-Address header" });

  const { name, tier } = req.body || {};
  if (!name || typeof name !== "string") return res.status(400).json({ error: "name is required" });
  if (!tier || !VALID_TIERS.includes(tier)) return res.status(400).json({ error: `tier must be one of: ${VALID_TIERS.join(", ")}` });

  try {
    const { key, record } = await generateApiKey(wallet, name, tier as ApiTier);

    await logAudit({
      wallet_address: wallet,
      action: "api_key_create",
      severity: "info",
      description: `Created ${tier} API key: ${name}`,
      metadata: { keyId: record.id, tier },
      ip_address: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || null,
    });

    return res.status(201).json({
      key,  // only shown once
      id: record.id,
      maskedKey: record.masked_key,
      name: record.name,
      tier: record.tier,
      rateLimitPerMin: record.rate_limit_per_min,
      monthlyQuota: record.monthly_quota,
      createdAt: record.created_at,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const wallet = getWallet(req);
  if (!wallet) return res.status(401).json({ error: "Missing or invalid X-Wallet-Address header" });

  try {
    const keys = await listApiKeys(wallet);
    return res.status(200).json({
      keys: keys.map((k) => ({
        id: k.id,
        maskedKey: k.masked_key,
        name: k.name,
        tier: k.tier,
        isActive: k.is_active,
        rateLimitPerMin: k.rate_limit_per_min,
        totalCalls: k.total_calls,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
        revokedAt: k.revoked_at,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleRevoke(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const wallet = getWallet(req);
  if (!wallet) return res.status(401).json({ error: "Missing or invalid X-Wallet-Address header" });

  const { keyId } = req.body || {};
  if (!keyId) return res.status(400).json({ error: "keyId is required" });

  try {
    const success = await revokeApiKey(keyId, wallet);
    if (!success) return res.status(404).json({ error: "Key not found or already revoked" });

    await logAudit({
      wallet_address: wallet,
      action: "api_key_revoke",
      severity: "warning",
      description: `Revoked API key: ${keyId}`,
      metadata: { keyId },
      ip_address: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || null,
    });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

const handlers: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<any>> = {
  generate: handleGenerate,
  list: handleList,
  revoke: handleRevoke,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin);
  if (req.method === "OPTIONS") return res.status(204).end();

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || "unknown";
  const { allowed } = checkRateLimit(ip, 30);
  if (!allowed) return res.status(429).json({ error: "Rate limited" });

  const action = req.query.action as string;
  const fn = handlers[action];
  if (!fn) return res.status(404).json({ error: `Unknown action: ${action}` });

  return fn(req, res);
}
