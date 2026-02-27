/**
 * GET  /api/holders/profile?wallet=0x...         → get display name
 * POST /api/holders/profile  { walletAddress, displayName }  → set/update display name
 *
 * Display name must pass profanity + format checks.
 * Server-side holder verification on POST.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCorsHeaders } from "../_lib/cors.js";
import { checkRateLimit } from "../_lib/rate-limit.js";
import { getSupabase } from "../_lib/supabase.js";
import { getWalletTier } from "../_lib/tier.js";
import { checkDisplayName } from "../_lib/profanity.js";

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin);
  if (req.method === "OPTIONS") return res.status(200).end();

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "unknown";

  // ── GET: fetch profile ──
  if (req.method === "GET") {
    const rl = checkRateLimit(`holders-profile-get:${ip}`, 60);
    if (!rl.allowed) return res.status(429).json({ error: "Rate limited" });

    const wallet = req.query.wallet as string;
    if (!wallet || !WALLET_RE.test(wallet)) {
      return res.status(400).json({ error: "Valid wallet address required" });
    }

    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from("holders_profiles")
        .select("display_name, created_at")
        .eq("wallet_address", wallet.toLowerCase())
        .single();

      return res.status(200).json({
        success: true,
        profile: data ? { displayName: data.display_name, createdAt: data.created_at } : null,
      });
    } catch (err: any) {
      console.error("[holders/profile] GET error:", err.message);
      return res.status(500).json({ error: "Internal error" });
    }
  }

  // ── POST: set/update display name ──
  if (req.method === "POST") {
    const rl = checkRateLimit(`holders-profile-set:${ip}`, 5);
    if (!rl.allowed) return res.status(429).json({ error: "Rate limited — try again in a minute" });

    const { walletAddress, displayName } = req.body || {};

    if (!walletAddress || typeof walletAddress !== "string" || !WALLET_RE.test(walletAddress)) {
      return res.status(400).json({ error: "Valid wallet address required" });
    }
    if (!displayName || typeof displayName !== "string") {
      return res.status(400).json({ error: "Display name is required" });
    }

    // Validate display name format + profanity
    const nameCheck = checkDisplayName(displayName);
    if (!nameCheck.valid) {
      return res.status(400).json({ error: nameCheck.reason });
    }

    try {
      // Server-side holder verification
      const { balance } = await getWalletTier(walletAddress);
      if (balance <= 0) {
        return res.status(403).json({ error: "Must hold $MONTRA tokens to set display name" });
      }

      const supabase = getSupabase();
      const trimmedName = displayName.trim();
      const walletLower = walletAddress.toLowerCase();

      // Check uniqueness (case-insensitive)
      const { data: existing } = await supabase
        .from("holders_profiles")
        .select("wallet_address")
        .ilike("display_name", trimmedName)
        .single();

      if (existing && existing.wallet_address !== walletLower) {
        return res.status(409).json({ error: "Display name is already taken" });
      }

      // Upsert profile
      const { data, error } = await supabase
        .from("holders_profiles")
        .upsert(
          {
            wallet_address: walletLower,
            display_name: trimmedName,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "wallet_address" },
        )
        .select("display_name, created_at")
        .single();

      if (error) {
        // Handle unique constraint violation
        if (error.code === "23505") {
          return res.status(409).json({ error: "Display name is already taken" });
        }
        console.error("[holders/profile] upsert error:", error);
        return res.status(500).json({ error: "Failed to save display name" });
      }

      return res.status(200).json({
        success: true,
        profile: { displayName: data.display_name, createdAt: data.created_at },
      });
    } catch (err: any) {
      console.error("[holders/profile] POST error:", err.message);
      return res.status(500).json({ error: "Internal error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
