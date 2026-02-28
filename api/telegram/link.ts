/**
 * GET/POST /api/telegram/link
 * Frontend-facing endpoint for wallet <-> Telegram linking.
 *
 * GET  ?wallet=0x... — Check link status
 * POST { wallet, code }           — Link wallet with code from bot
 * POST { wallet, action: "disconnect" } — Unlink
 * POST { wallet, alertTypes: [...] }    — Update alert preferences
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { setCorsHeaders } from "../_lib/cors.js";
import { sendTelegramMessage } from "../_lib/telegram.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin as string | undefined);
  if (req.method === "OPTIONS") return res.status(200).end();

  const supabase = getSupabase();

  // ── GET: check link status ────────────────────────────────────────────
  if (req.method === "GET") {
    const wallet = ((req.query.wallet as string) || "").toLowerCase();
    if (!wallet) return res.status(400).json({ error: "wallet required" });

    const { data } = await supabase
      .from("telegram_links")
      .select("telegram_username, alert_types, created_at")
      .eq("wallet_address", wallet)
      .eq("is_active", true)
      .maybeSingle();

    if (!data) return res.json({ linked: false });

    return res.json({
      linked: true,
      telegramUsername: data.telegram_username,
      alertTypes: data.alert_types,
      linkedAt: data.created_at,
    });
  }

  // ── POST: link / disconnect / update ──────────────────────────────────
  if (req.method === "POST") {
    const { wallet, code, action, alertTypes } = req.body || {};
    const walletLower = (wallet || "").toLowerCase();
    if (!walletLower) return res.status(400).json({ error: "wallet required" });

    // ── Disconnect ────────────────────────────────────────────────────
    if (action === "disconnect") {
      const { data: link } = await supabase
        .from("telegram_links")
        .select("telegram_user_id")
        .eq("wallet_address", walletLower)
        .eq("is_active", true)
        .maybeSingle();

      if (link) {
        await supabase
          .from("telegram_links")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("wallet_address", walletLower);

        await sendTelegramMessage(
          link.telegram_user_id,
          "🔌 Your wallet has been disconnected from Montra Finance. You'll no longer receive alerts.",
        ).catch(() => {});
      }

      return res.json({ success: true, message: "Disconnected" });
    }

    // ── Update alert types ────────────────────────────────────────────
    if (alertTypes && Array.isArray(alertTypes)) {
      await supabase
        .from("telegram_links")
        .update({ alert_types: alertTypes, updated_at: new Date().toISOString() })
        .eq("wallet_address", walletLower)
        .eq("is_active", true);

      return res.json({ success: true, message: "Alert preferences updated" });
    }

    // ── Link with code ────────────────────────────────────────────────
    if (!code) return res.status(400).json({ error: "code required" });

    const codeUpper = (code as string).toUpperCase().trim();

    // Find pending link by code (wallet_address is empty = pending)
    const { data: pending } = await supabase
      .from("telegram_links")
      .select("*")
      .eq("link_code", codeUpper)
      .eq("wallet_address", "")
      .maybeSingle();

    if (!pending) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    // Check code age (10 minutes)
    const codeAge = Date.now() - new Date(pending.updated_at || pending.created_at).getTime();
    if (codeAge > 10 * 60 * 1000) {
      return res.status(400).json({ error: "Code expired. Send /connect again in Telegram." });
    }

    // Check if this wallet is already linked
    const { data: existingWallet } = await supabase
      .from("telegram_links")
      .select("id")
      .eq("wallet_address", walletLower)
      .eq("is_active", true)
      .maybeSingle();

    if (existingWallet) {
      return res.status(400).json({ error: "This wallet is already linked to a Telegram account" });
    }

    // Activate the link
    await supabase
      .from("telegram_links")
      .update({
        wallet_address: walletLower,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pending.id);

    // Notify on Telegram
    await sendTelegramMessage(
      pending.telegram_user_id,
      `✅ <b>Wallet Connected!</b>\n\nLinked to: <code>${walletLower.slice(0, 6)}...${walletLower.slice(-4)}</code>\n\nYou'll now receive agent alerts here. Use /alerts to customize.`,
    ).catch(() => {});

    // Log activity (non-blocking)
    try {
      await supabase.from("telegram_activity_log").insert({
        telegram_user_id: pending.telegram_user_id,
        wallet_address: walletLower,
        action: "wallet_linked",
        details: { method: "code" },
      });
    } catch {
      // non-critical
    }

    return res.json({
      success: true,
      message: "Wallet linked",
      telegramUsername: pending.telegram_username,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
