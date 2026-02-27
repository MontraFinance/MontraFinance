/**
 * POST /api/holders/send
 * Send a message to the holders group chat.
 * Server-side tier verification — must hold $MONTRA tokens.
 * Includes profanity filter and @mention ping creation.
 * Body: { walletAddress: string, message: string }
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCorsHeaders } from "../_lib/cors.js";
import { checkRateLimit } from "../_lib/rate-limit.js";
import { getSupabase } from "../_lib/supabase.js";
import { getWalletTier } from "../_lib/tier.js";
import { checkProfanity } from "../_lib/profanity.js";

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const MENTION_RE = /@([a-zA-Z][a-zA-Z0-9_.\-]{1,19})/g;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(`holders-send:${ip}`, 10);
  if (!rl.allowed) return res.status(429).json({ error: "Rate limited — max 10 messages per minute" });

  const { walletAddress, message } = req.body || {};

  if (!walletAddress || typeof walletAddress !== "string" || !WALLET_RE.test(walletAddress)) {
    return res.status(400).json({ error: "Valid wallet address required" });
  }
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Message is required" });
  }
  if (message.length > 500) {
    return res.status(400).json({ error: "Message too long (max 500 characters)" });
  }

  // Profanity check
  const profCheck = checkProfanity(message);
  if (!profCheck.clean) {
    return res.status(400).json({ error: profCheck.reason });
  }

  try {
    // Server-side holder verification — read on-chain balance
    const { tier, balance } = await getWalletTier(walletAddress);

    if (balance <= 0) {
      return res.status(403).json({ error: "Must hold $MONTRA tokens to send messages" });
    }

    const supabase = getSupabase();
    const content = message.trim();

    const { data, error } = await supabase
      .from("holders_chat_messages")
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        content,
        tier,
      })
      .select("id, wallet_address, content, tier, created_at")
      .single();

    if (error) {
      console.error("[holders/send] insert error:", error);
      return res.status(500).json({ error: "Failed to send message" });
    }

    // Parse @mentions and create pings
    const mentions = [...content.matchAll(MENTION_RE)].map((m) => m[1]);
    if (mentions.length > 0 && data) {
      try {
        // Look up wallet addresses for mentioned display names
        const { data: profiles } = await supabase
          .from("holders_profiles")
          .select("wallet_address, display_name")
          .in(
            "display_name",
            mentions.map((m) => m),
          );

        // Also try case-insensitive match
        const matchedProfiles = profiles || [];
        if (matchedProfiles.length === 0 && mentions.length > 0) {
          // Fallback: query each mention individually with ilike
          for (const mention of mentions.slice(0, 5)) {
            const { data: profile } = await supabase
              .from("holders_profiles")
              .select("wallet_address, display_name")
              .ilike("display_name", mention)
              .single();
            if (profile) matchedProfiles.push(profile);
          }
        }

        // Create ping entries (exclude self-pings)
        const pings = matchedProfiles
          .filter((p) => p.wallet_address !== walletAddress.toLowerCase())
          .map((p) => ({
            message_id: data.id,
            from_wallet: walletAddress.toLowerCase(),
            to_wallet: p.wallet_address,
          }));

        if (pings.length > 0) {
          await supabase.from("holders_pings").insert(pings);
        }
      } catch (pingErr: any) {
        // Non-critical — message was already sent
        console.error("[holders/send] ping error:", pingErr.message);
      }
    }

    return res.status(200).json({ success: true, message: data });
  } catch (err: any) {
    console.error("[holders/send] error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}
