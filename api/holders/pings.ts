/**
 * GET  /api/holders/pings?wallet=0x...          → get unread ping count
 * POST /api/holders/pings  { walletAddress }    → mark all pings as read
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCorsHeaders } from "../_lib/cors.js";
import { checkRateLimit } from "../_lib/rate-limit.js";
import { getSupabase } from "../_lib/supabase.js";

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin);
  if (req.method === "OPTIONS") return res.status(200).end();

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "unknown";

  // ── GET: unread ping count ──
  if (req.method === "GET") {
    const rl = checkRateLimit(`holders-pings-get:${ip}`, 60);
    if (!rl.allowed) return res.status(429).json({ error: "Rate limited" });

    const wallet = req.query.wallet as string;
    if (!wallet || !WALLET_RE.test(wallet)) {
      return res.status(400).json({ error: "Valid wallet address required" });
    }

    try {
      const supabase = getSupabase();

      const { count, error } = await supabase
        .from("holders_pings")
        .select("id", { count: "exact", head: true })
        .eq("to_wallet", wallet.toLowerCase())
        .eq("read", false);

      if (error) {
        console.error("[holders/pings] count error:", error);
        return res.status(500).json({ error: "Failed to fetch pings" });
      }

      return res.status(200).json({ success: true, unread: count || 0 });
    } catch (err: any) {
      console.error("[holders/pings] GET error:", err.message);
      return res.status(500).json({ error: "Internal error" });
    }
  }

  // ── POST: mark all as read ──
  if (req.method === "POST") {
    const rl = checkRateLimit(`holders-pings-read:${ip}`, 10);
    if (!rl.allowed) return res.status(429).json({ error: "Rate limited" });

    const { walletAddress } = req.body || {};
    if (!walletAddress || typeof walletAddress !== "string" || !WALLET_RE.test(walletAddress)) {
      return res.status(400).json({ error: "Valid wallet address required" });
    }

    try {
      const supabase = getSupabase();

      const { error } = await supabase
        .from("holders_pings")
        .update({ read: true })
        .eq("to_wallet", walletAddress.toLowerCase())
        .eq("read", false);

      if (error) {
        console.error("[holders/pings] update error:", error);
        return res.status(500).json({ error: "Failed to mark pings as read" });
      }

      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("[holders/pings] POST error:", err.message);
      return res.status(500).json({ error: "Internal error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
