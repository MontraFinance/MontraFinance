/**
 * GET /api/holders/messages?limit=50&before=<iso-timestamp>
 * Fetch recent holders chat messages (group chatroom).
 * Joins display names from holders_profiles.
 * No tier check on read — gating enforced on write + UI.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCorsHeaders } from "../_lib/cors.js";
import { checkRateLimit } from "../_lib/rate-limit.js";
import { getSupabase } from "../_lib/supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(`holders-msgs:${ip}`, 60);
  if (!rl.allowed) return res.status(429).json({ error: "Rate limited" });

  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1), 100);
  const before = req.query.before as string | undefined;

  try {
    const supabase = getSupabase();

    let query = supabase
      .from("holders_chat_messages")
      .select("id, wallet_address, content, tier, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[holders/messages] query error:", error);
      return res.status(500).json({ error: "Failed to fetch messages" });
    }

    const rows = data || [];

    // Collect unique wallet addresses and fetch display names
    const wallets = [...new Set(rows.map((r) => r.wallet_address))];
    let profileMap: Record<string, string> = {};

    if (wallets.length > 0) {
      const { data: profiles } = await supabase
        .from("holders_profiles")
        .select("wallet_address, display_name")
        .in("wallet_address", wallets);

      if (profiles) {
        for (const p of profiles) {
          profileMap[p.wallet_address] = p.display_name;
        }
      }
    }

    // Reverse so messages are in chronological order, attach display names
    const messages = rows.reverse().map((msg) => ({
      ...msg,
      display_name: profileMap[msg.wallet_address] || null,
    }));

    return res.status(200).json({ success: true, messages });
  } catch (err: any) {
    console.error("[holders/messages] error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}
