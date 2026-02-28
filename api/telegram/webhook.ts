/**
 * POST /api/telegram/webhook
 * Receives Telegram bot updates via webhook.
 * Handles commands + conversational AI via Qwen 3 14B (Ollama).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { sendTelegramMessage, generateLinkCode, sendChatAction, esc } from "../_lib/telegram.js";
import { queryMontraAI } from "../_lib/montra-ai.js";
import { checkRateLimit } from "../_lib/rate-limit.js";

// Allow up to 60s for AI queries
export const config = { maxDuration: 60 };

// ── Types ───────────────────────────────────────────────────────────────────

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
}

// ── Constants ───────────────────────────────────────────────────────────────

const VALID_ALERT_TYPES = ["trade", "trade_filled", "ai_insight", "milestone", "burn", "status"];

const TELEGRAM_AI_SYSTEM_PROMPT = `You are the Montra Finance Bot, an AI assistant for the Montra Finance DeFi platform on Base chain.

Your role:
- Answer questions about the user's trading agents, portfolio, P&L, and strategies
- Explain DeFi concepts, trading strategies, and how Montra Finance works
- Provide market insights based on the user's portfolio context
- Be concise — keep responses under 2000 characters
- Use plain text. Do NOT use any HTML tags or markdown formatting

You must NOT:
- Provide specific financial advice or tell users what to buy/sell
- Make up data — only reference information from the user context provided
- Respond with JSON — you are in conversational mode
- Include any <think> tags or internal reasoning markers in your response

About Montra Finance:
- Institutional-grade AI trading terminal on Base (Ethereum L2)
- Users deploy autonomous trading agents with custom strategies
- Agents use CoW Protocol for MEV-protected swaps
- $MONTRA tokens are burned for AI consultation fees
- Supports Diamond/Gold/Silver/Bronze tier system based on $MONTRA holdings
- Integrates with Farcaster for social sentiment trading`;

// ── Agent summary ───────────────────────────────────────────────────────────

async function getAgentsSummary(
  supabase: any,
  command: string,
  walletAddress: string,
): Promise<string> {
  const { data: agents } = await supabase
    .from("agents")
    .select("id, config, stats, status")
    .eq("wallet_address", walletAddress);

  if (!agents || agents.length === 0) {
    return "No agents found for your wallet. Deploy one at montrafinance.com";
  }

  if (command === "agents") {
    const lines = agents.slice(0, 10).map((a: any) =>
      `• ${a.config?.name || a.id.slice(0, 8)} (${a.status})`,
    );
    return `<b>Your Agents:</b>\n${lines.join("\n")}`;
  }

  if (command === "status") {
    const lines = agents.slice(0, 5).map((a: any) =>
      `• <b>${a.config?.name || a.id.slice(0, 8)}</b>: ${a.status} | Trades: ${a.stats?.tradeCount ?? 0} | P&L: $${(a.stats?.pnlUsd ?? 0).toFixed(2)}`,
    );
    return `<b>Agent Status:</b>\n${lines.join("\n")}`;
  }

  if (command === "pnl") {
    const totalPnl = agents.reduce((sum: number, a: any) => sum + (a.stats?.pnlUsd ?? 0), 0);
    const lines = agents.slice(0, 5).map((a: any) =>
      `• ${a.config?.name || a.id.slice(0, 8)}: $${(a.stats?.pnlUsd ?? 0).toFixed(2)}`,
    );
    return `<b>P&amp;L (Total: $${totalPnl.toFixed(2)}):</b>\n${lines.join("\n")}`;
  }

  if (command === "trades") {
    const totalTrades = agents.reduce((sum: number, a: any) => sum + (a.stats?.tradeCount ?? 0), 0);
    const lines = agents.slice(0, 5).map((a: any) =>
      `• ${a.config?.name || a.id.slice(0, 8)}: ${a.stats?.tradeCount ?? 0} trades`,
    );
    return `<b>Trades (Total: ${totalTrades}):</b>\n${lines.join("\n")}`;
  }

  return "Unknown command.";
}

// ── Agent name search (ported from bot/chat.ts) ─────────────────────────────

function findAgentByName(
  agents: any[],
  search: string,
): { agent: any; ambiguous: boolean; names: string[] } {
  const q = search.toLowerCase();
  const names = agents.map((a: any) => a.config?.name || a.id.slice(0, 8));
  const matches = agents.filter((a: any) =>
    (a.config?.name || a.id.slice(0, 8)).toLowerCase().includes(q),
  );
  if (matches.length === 1) return { agent: matches[0], ambiguous: false, names };
  if (matches.length > 1) return { agent: null, ambiguous: true, names: matches.map((a: any) => a.config?.name || a.id.slice(0, 8)) };
  return { agent: null, ambiguous: false, names };
}

// ── Build user context for AI ───────────────────────────────────────────────

async function buildTelegramUserContext(
  supabase: any,
  walletAddress: string,
): Promise<string> {
  const { data: agents } = await supabase
    .from("agents")
    .select("id, config, stats, status, wallet_data")
    .eq("wallet_address", walletAddress);

  if (!agents || agents.length === 0) {
    return "The user has no agents deployed yet.";
  }

  const totalPnl = agents.reduce((sum: number, a: any) => sum + (a.stats?.pnlUsd ?? 0), 0);
  const totalTrades = agents.reduce((sum: number, a: any) => sum + (a.stats?.tradeCount ?? 0), 0);

  const agentLines = agents.slice(0, 10).map((a: any) => {
    const cfg = a.config || {};
    const st = a.stats || {};
    return `- ${cfg.name || a.id.slice(0, 8)} (${a.status}): Strategy=${cfg.strategyId || "unknown"}, P&L=$${(st.pnlUsd ?? 0).toFixed(2)} (${(st.pnlPct ?? 0).toFixed(1)}%), Trades=${st.tradeCount ?? 0}, WinRate=${(st.winRate ?? 0).toFixed(0)}%`;
  }).join("\n");

  return `User Portfolio:
- Total Agents: ${agents.length}
- Combined P&L: $${totalPnl.toFixed(2)}
- Total Trades: ${totalTrades}

Agents:
${agentLines}`;
}

// ── AI query handler ────────────────────────────────────────────────────────

async function handleAIQuery(
  supabase: any,
  chatId: number,
  userId: number,
  walletAddress: string,
  userMessage: string,
): Promise<void> {
  // Rate limit: 10 AI queries per minute per user
  const rl = checkRateLimit(`tg-ai:${userId}`, 10, 60_000);
  if (!rl.allowed) {
    await sendTelegramMessage(chatId, "You're sending too many messages. Please wait a moment and try again.");
    return;
  }

  // Show typing indicator
  await sendChatAction(chatId, "typing");

  // Build context
  const context = await buildTelegramUserContext(supabase, walletAddress);
  const userPrompt = `${context}\n\nUser's message: ${userMessage}`;

  try {
    const aiResponse = await queryMontraAI(TELEGRAM_AI_SYSTEM_PROMPT, userPrompt);

    if (!aiResponse || aiResponse.trim().length === 0) {
      await sendTelegramMessage(chatId, "I couldn't generate a response. Please try again.");
      return;
    }

    // Truncate to stay under Telegram's 4096 char limit
    let response = aiResponse.trim();
    // Strip any <think>...</think> tags the model might include
    response = response.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (response.length > 3900) {
      response = response.slice(0, 3900) + "\n\n... (response truncated)";
    }

    // Send as plain text (no parse_mode) to avoid HTML parsing errors from AI output
    await sendTelegramMessage(chatId, response, { parseMode: undefined as any });
    await logActivity(supabase, userId, walletAddress, "ai_query", {
      question: userMessage.slice(0, 200),
    });
  } catch (err: any) {
    console.error("[telegram/webhook] AI query error:", err.message);

    if (err.message?.includes("timeout") || err.message?.includes("GPU_URL")) {
      await sendTelegramMessage(chatId,
        "🔧 Our AI is currently unavailable. Please try again in a few minutes.\n\nYou can still use commands like /status, /pnl, /agents.",
      );
    } else {
      await sendTelegramMessage(chatId,
        "Something went wrong processing your message. Please try again.",
      );
    }
  }
}

// ── Log activity ────────────────────────────────────────────────────────────

async function logActivity(
  supabase: any,
  telegramUserId: number,
  walletAddress: string | null,
  action: string,
  details?: any,
) {
  try {
    await supabase.from("telegram_activity_log").insert({
      telegram_user_id: telegramUserId,
      wallet_address: walletAddress,
      action,
      details: details || null,
    });
  } catch {
    // non-critical
  }
}

// ── Main Handler ────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Verify webhook secret
  const secret = req.headers["x-telegram-bot-api-secret-token"];
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const update: TelegramUpdate = req.body;
  const message = update?.message;
  if (!message?.text || !message?.from?.id) {
    return res.status(200).json({ ok: true });
  }

  const chatId = message.chat.id;
  const userId = message.from.id;
  const username = message.from.username || null;
  const text = message.text.trim();
  const cmd = text.toLowerCase();

  const supabase = getSupabase();

  try {
    // ── /start ────────────────────────────────────────────────────────────
    if (cmd === "/start") {
      await sendTelegramMessage(chatId, [
        "🤖 <b>Montra Finance Bot</b>",
        "",
        "Institutional-grade AI trading terminal on Base.",
        "",
        "I'll send you real-time alerts when your agents:",
        "• Execute trades",
        "• Complete AI check-ins",
        "• Hit P&amp;L milestones",
        "• Burn $MONTRA for compute",
        "",
        "Use /connect to link your wallet and start receiving alerts.",
        "",
        "📖 <b>Commands:</b>",
        "/connect — Link your wallet",
        "/status — View agent statuses",
        "/pnl — View P&amp;L breakdown",
        "/agents — List your agents",
        "/trades — View trade counts",
        "/alerts — Manage alert preferences",
        "/burns — View $MONTRA burn stats",
        "/ask — Ask the AI a question",
        "/pause — Pause an agent",
        "/resume — Resume an agent",
        "/stop — Stop an agent",
        "/disconnect — Unlink wallet",
        "/help — Show this message",
        "",
        "🧠 Or just send me a message and I'll answer using AI!",
        "",
        '🔗 <a href="https://montrafinance.com">montrafinance.com</a>',
      ].join("\n"));
      await logActivity(supabase, userId, null, "start");
      return res.status(200).json({ ok: true });
    }

    // ── /connect ──────────────────────────────────────────────────────────
    if (cmd === "/connect") {
      const { data: existing } = await supabase
        .from("telegram_links")
        .select("wallet_address, is_active")
        .eq("telegram_user_id", userId)
        .maybeSingle();

      if (existing?.is_active && existing.wallet_address) {
        const addr = existing.wallet_address;
        await sendTelegramMessage(chatId,
          `You're already linked to wallet <code>${addr.slice(0, 6)}...${addr.slice(-4)}</code>.\n\nUse /disconnect first to link a different wallet.`,
        );
        return res.status(200).json({ ok: true });
      }

      const code = generateLinkCode();

      await supabase.from("telegram_links").upsert(
        {
          telegram_user_id: userId,
          telegram_username: username,
          wallet_address: "",
          link_code: code,
          is_active: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "telegram_user_id" },
      );

      await sendTelegramMessage(chatId, [
        `🔗 <b>Link Code:</b> <code>${code}</code>`,
        "",
        "To connect your wallet:",
        "1. Go to <b>montrafinance.com/messages</b>",
        "2. Click the <b>TELEGRAM</b> tab",
        '3. Enter this code and click "LINK"',
        "",
        "Code expires in 10 minutes.",
      ].join("\n"));
      await logActivity(supabase, userId, null, "connect_requested", { code });
      return res.status(200).json({ ok: true });
    }

    // ── /disconnect ───────────────────────────────────────────────────────
    if (cmd === "/disconnect") {
      const { data: dLink } = await supabase
        .from("telegram_links")
        .select("wallet_address")
        .eq("telegram_user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (!dLink) {
        await sendTelegramMessage(chatId, "No wallet is currently linked. Use /connect to link one.");
        return res.status(200).json({ ok: true });
      }

      await supabase
        .from("telegram_links")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("telegram_user_id", userId);

      await sendTelegramMessage(chatId, "🔌 Wallet disconnected. You'll no longer receive alerts.\n\nUse /connect to link again.");
      await logActivity(supabase, userId, dLink.wallet_address, "disconnected");
      return res.status(200).json({ ok: true });
    }

    // ── /help ─────────────────────────────────────────────────────────────
    if (cmd === "/help") {
      await sendTelegramMessage(chatId, [
        "📖 <b>Montra Bot Commands</b>",
        "",
        "/connect — Link your wallet",
        "/status — View agent statuses",
        "/pnl — View P&amp;L breakdown",
        "/agents — List your agents",
        "/trades — View trade counts",
        "/alerts — Manage alert preferences",
        "/burns — $MONTRA burn stats",
        "/ask &lt;question&gt; — Ask the AI anything",
        "/pause &lt;name&gt; — Pause an agent",
        "/resume &lt;name&gt; — Resume a paused agent",
        "/stop &lt;name&gt; — Stop an agent",
        "/disconnect — Unlink wallet",
        "/help — Show this message",
        "",
        "🧠 Or just send me a message and I'll answer with AI!",
      ].join("\n"));
      return res.status(200).json({ ok: true });
    }

    // ── Wallet link lookup ──────────────────────────────────────────────

    const { data: link } = await supabase
      .from("telegram_links")
      .select("wallet_address, alert_types")
      .eq("telegram_user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    // ── /burns (works with or without wallet) ───────────────────────────
    if (cmd === "/burns") {
      const { data: userBurns } = await supabase
        .from("burn_transactions")
        .select("amount_burned")
        .in("status", ["confirmed", "processed"]);

      const totalUserBurned = (userBurns || []).reduce(
        (sum: number, r: any) => sum + (r.amount_burned || 0), 0,
      );

      let bbBurned = 0;
      let bbUsdc = 0;
      try {
        const { data: bb } = await supabase
          .from("buyback_orders")
          .select("montra_burned, usdc_amount")
          .eq("status", "filled")
          .gt("montra_burned", 0);
        if (bb) {
          bbBurned = bb.reduce((s: number, r: any) => s + (r.montra_burned || 0), 0);
          bbUsdc = bb.reduce((s: number, r: any) => s + (r.usdc_amount || 0), 0);
        }
      } catch {
        // buyback_orders table may not exist
      }

      const totalBurned = totalUserBurned + bbBurned;

      const parts: string[] = [
        "🔥 <b>$MONTRA Burn Stats</b>",
        "",
        `Total Burned: <b>${totalBurned.toLocaleString()}</b> MONTRA`,
        `User Burns: ${totalUserBurned.toLocaleString()} (${(userBurns || []).length} txns)`,
        `Buyback Burns: ${bbBurned.toLocaleString()} ($${bbUsdc.toFixed(2)} USDC spent)`,
      ];

      // Personal stats if wallet is linked
      if (link?.wallet_address) {
        const { data: myBurns, count } = await supabase
          .from("burn_transactions")
          .select("amount_burned", { count: "exact" })
          .eq("wallet_address", link.wallet_address)
          .in("status", ["confirmed", "processed"]);

        const myTotal = (myBurns || []).reduce(
          (s: number, r: any) => s + (r.amount_burned || 0), 0,
        );

        parts.push("");
        parts.push(`<b>Your Burns:</b> ${myTotal.toLocaleString()} MONTRA (${count || 0} txns)`);
      }

      await sendTelegramMessage(chatId, parts.join("\n"));
      await logActivity(supabase, userId, link?.wallet_address || null, "burns");
      return res.status(200).json({ ok: true });
    }

    // ── Guard: commands requiring linked wallet ─────────────────────────

    if (!link || !link.wallet_address) {
      if (["/status", "/pnl", "/agents", "/trades", "/alerts", "/ask", "/pause", "/resume", "/stop"].some((c) => cmd.startsWith(c))) {
        await sendTelegramMessage(chatId, "⚠️ No wallet linked. Use /connect first.");
        return res.status(200).json({ ok: true });
      }
      // Non-command text from unlinked user
      if (!cmd.startsWith("/")) {
        await sendTelegramMessage(chatId, "Link your wallet with /connect to chat with me about your portfolio.");
        return res.status(200).json({ ok: true });
      }
      // Unknown command from unlinked user — ignore
      return res.status(200).json({ ok: true });
    }

    // ── /status, /pnl, /agents, /trades ─────────────────────────────────
    if (["/status", "/pnl", "/agents", "/trades"].includes(cmd)) {
      const command = cmd.slice(1);
      const reply = await getAgentsSummary(supabase, command, link.wallet_address);
      await sendTelegramMessage(chatId, reply);
      await logActivity(supabase, userId, link.wallet_address, command);
      return res.status(200).json({ ok: true });
    }

    // ── /alerts (view / toggle) ─────────────────────────────────────────
    if (cmd === "/alerts") {
      const types = link.alert_types || VALID_ALERT_TYPES;
      const lines = VALID_ALERT_TYPES.map((t) =>
        `${types.includes(t) ? "✅" : "❌"} ${t}`,
      );
      await sendTelegramMessage(chatId, [
        "<b>Alert Preferences:</b>",
        "",
        ...lines,
        "",
        "Toggle with: <code>/alerts on trade</code> or <code>/alerts off milestone</code>",
      ].join("\n"));
      return res.status(200).json({ ok: true });
    }

    if (cmd.startsWith("/alerts on ") || cmd.startsWith("/alerts off ")) {
      const parts = cmd.split(" ");
      const action = parts[1]; // "on" or "off"
      const alertType = parts.slice(2).join(" ").trim();

      if (!VALID_ALERT_TYPES.includes(alertType)) {
        await sendTelegramMessage(chatId, `Unknown alert type "${alertType}".\nValid types: ${VALID_ALERT_TYPES.join(", ")}`);
        return res.status(200).json({ ok: true });
      }

      let types = [...(link.alert_types || VALID_ALERT_TYPES)];
      if (action === "on" && !types.includes(alertType)) {
        types.push(alertType);
      } else if (action === "off") {
        types = types.filter((t) => t !== alertType);
      }

      await supabase
        .from("telegram_links")
        .update({ alert_types: types, updated_at: new Date().toISOString() })
        .eq("telegram_user_id", userId);

      const emoji = action === "on" ? "✅" : "❌";
      await sendTelegramMessage(chatId, `${emoji} Alert type "<b>${alertType}</b>" ${action === "on" ? "enabled" : "disabled"}.`);
      await logActivity(supabase, userId, link.wallet_address, `alerts_${action}`, { alertType });
      return res.status(200).json({ ok: true });
    }

    // ── /ask <question> ─────────────────────────────────────────────────
    if (cmd.startsWith("/ask")) {
      const question = text.slice(4).trim();
      if (!question) {
        await sendTelegramMessage(chatId, "Usage: <code>/ask your question here</code>");
        return res.status(200).json({ ok: true });
      }
      await handleAIQuery(supabase, chatId, userId, link.wallet_address, question);
      return res.status(200).json({ ok: true });
    }

    // ── /pause, /resume, /stop <name> ───────────────────────────────────
    const controlMatch = cmd.match(/^\/(pause|resume|stop)\s+(.+)$/);
    if (controlMatch) {
      const action = controlMatch[1];
      const search = controlMatch[2].trim();

      const { data: agents } = await supabase
        .from("agents")
        .select("id, config, status")
        .eq("wallet_address", link.wallet_address);

      if (!agents || agents.length === 0) {
        await sendTelegramMessage(chatId, "No agents found. Deploy one at montrafinance.com");
        return res.status(200).json({ ok: true });
      }

      const { agent, ambiguous, names } = findAgentByName(agents, search);

      if (ambiguous) {
        await sendTelegramMessage(chatId,
          `Multiple agents match "<b>${esc(search)}</b>":\n${names.map((n) => `• ${esc(n)}`).join("\n")}\n\nPlease be more specific.`,
        );
        return res.status(200).json({ ok: true });
      }

      if (!agent) {
        await sendTelegramMessage(chatId,
          `No agent found matching "<b>${esc(search)}</b>".\n\nYour agents:\n${names.map((n) => `• ${esc(n)}`).join("\n")}`,
        );
        return res.status(200).json({ ok: true });
      }

      const agentName = agent.config?.name || agent.id.slice(0, 8);
      const statusMap: Record<string, string> = { pause: "paused", resume: "active", stop: "stopped" };
      const newStatus = statusMap[action];

      if (agent.status === newStatus) {
        await sendTelegramMessage(chatId, `${esc(agentName)} is already ${newStatus}.`);
        return res.status(200).json({ ok: true });
      }

      const { error: updateErr } = await supabase
        .from("agents")
        .update({ status: newStatus })
        .eq("id", agent.id);

      if (updateErr) {
        await sendTelegramMessage(chatId, `Failed to ${action} ${esc(agentName)}. Please try again.`);
        return res.status(200).json({ ok: true });
      }

      const emoji = action === "pause" ? "⏸" : action === "resume" ? "▶️" : "⏹";
      const verb = newStatus === "active" ? "resumed" : newStatus;
      await sendTelegramMessage(chatId, `${emoji} <b>${esc(agentName)}</b> has been ${verb}.`);
      await logActivity(supabase, userId, link.wallet_address, `agent_${action}`, { agentId: agent.id, agentName });
      return res.status(200).json({ ok: true });
    }

    // ── Conversational AI fallback (non-command messages) ───────────────
    if (!cmd.startsWith("/")) {
      await handleAIQuery(supabase, chatId, userId, link.wallet_address, text);
      return res.status(200).json({ ok: true });
    }

    // Unknown /command — silently ignore
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[telegram/webhook] Error:", err.message);
    return res.status(200).json({ ok: true }); // Always 200 to Telegram
  }
}
