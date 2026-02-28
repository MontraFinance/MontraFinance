/**
 * Telegram Bot API helpers for MontraFi
 * Mirrors api/_lib/xmtp.ts pattern — shared by webhook, link, notify endpoints.
 */

const TELEGRAM_API = "https://api.telegram.org/bot";

// ── Send a Telegram message (HTML) ──────────────────────────────────────────

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options?: { parseMode?: "HTML" | "MarkdownV2"; disablePreview?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };

  try {
    const resp = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode || "HTML",
        disable_web_page_preview: options?.disablePreview ?? true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await resp.json();
    if (!data.ok) return { ok: false, error: data.description || "Telegram API error" };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ── Generate a 6-char link code ─────────────────────────────────────────────

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateLinkCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// ── Format alert for Telegram (HTML) ────────────────────────────────────────

export function formatTelegramAlert(
  alertType: string,
  data: Record<string, any>,
): string {
  switch (alertType) {
    case "trade":
      return `🔄 <b>Trade Alert</b>\nAgent "<b>${esc(data.agentName || data.agentId)}</b>" executed a ${esc(data.side || "swap")} — ${esc(data.sellToken)} → ${esc(data.buyToken)}.\nAmount: ${esc(data.amount || "N/A")}`;

    case "trade_filled": {
      const agent = esc(data.agentName || data.agentId || "Agent");
      const side = (data.side || "swap").toUpperCase();
      const sell = `${esc(data.sellAmount || "?")} ${esc(data.sellToken || "?")}`;
      const buy = `${esc(data.buyAmount || "?")} ${esc(data.buyToken || "?")}`;
      const price = data.entryPrice ? `\nEntry Price: ${esc(data.entryPrice)}` : "";
      const venue = data.venue ? `\nVenue: ${esc(data.venue)}` : "";
      return `✅ <b>Trade Filled</b> — ${agent}\n\n<b>${side}:</b> ${sell} → ${buy}${price}${venue}`;
    }

    case "ai_insight":
      return formatTelegramAiInsight(data);

    case "milestone":
      return `🎯 <b>Milestone</b>\nAgent "<b>${esc(data.agentName || data.agentId)}</b>" crossed ${esc(data.milestone || "a new milestone")}!\nCurrent P&amp;L: ${esc(data.pnl || "N/A")}`;

    case "burn":
      return `🔥 <b>Burn Confirmed</b>\n${esc(data.amount || "?")} $MONTRA burned on Base.\n<a href="https://basescan.org/tx/${esc(data.txHash || "")}">View on BaseScan</a>`;

    case "status":
      return `📊 <b>Agent Status</b>\n"<b>${esc(data.agentName || data.agentId)}</b>": ${esc(data.status || "unknown")}\nTrades: ${data.trades || 0} | P&amp;L: ${esc(data.pnl || "$0")}`;

    default:
      return `📢 <b>Montra Alert</b>\n${esc(JSON.stringify(data).slice(0, 500))}`;
  }
}

// ── AI Insight (compact HTML for Telegram's 4096-char limit) ────────────────

function formatTelegramAiInsight(data: Record<string, any>): string {
  const name = esc(data.agentName || data.agentId || "Agent");
  const action = (data.action || "hold").toUpperCase();
  const confidence = data.confidence || 0;
  const parts: string[] = [];

  parts.push(`🤖 <b>${name} — AI Check-in</b>`);

  // Market
  if (data.ethPrice || data.btcPrice) {
    let market = "📊 ";
    if (data.ethPrice) market += `ETH: $${Number(data.ethPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (data.btcPrice) market += ` | BTC: $${Number(data.btcPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    parts.push(market);
  }

  // CEX Portfolio
  if (data.cexPortfolio) {
    const cex = data.cexPortfolio;
    parts.push(`\n💰 <b>${esc((cex.exchange || "EXCHANGE").toUpperCase())}</b> — $${Number(cex.totalPortfolioUsd || 0).toFixed(2)}`);
    if (cex.spotBalances?.length) {
      const spotLines = cex.spotBalances.slice(0, 5).map((b: any) => {
        const total = (b.free || 0) + (b.locked || 0);
        const isStable = ["USDT", "USDC", "USD"].includes((b.coin || "").toUpperCase());
        return `  ${b.coin}: ${total.toFixed(isStable ? 2 : 6)}`;
      });
      parts.push(spotLines.join("\n"));
    }
    if (cex.futuresPositions?.length) {
      for (const p of cex.futuresPositions.slice(0, 3)) {
        const pnl = parseFloat(p.unrealizedPNL || "0");
        parts.push(`  ${p.side} ${p.symbol} ${p.leverage}x | PNL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`);
      }
    }
  } else if (data.usdcBalance !== undefined) {
    let wallet = "\n💰 Wallet:";
    if (data.usdcBalance !== undefined) wallet += ` USDC $${Number(data.usdcBalance).toFixed(2)}`;
    if (data.ethBalance !== undefined) wallet += ` | ETH ${Number(data.ethBalance).toFixed(6)}`;
    parts.push(wallet);
  }

  // Fleet
  if (data.totalAgents && data.totalAgents > 1) {
    parts.push(`\n👥 Fleet: ${data.totalAgents} agents | Combined P&amp;L: $${Number(data.combinedPnl || 0).toFixed(2)}`);
  }

  // AI reasoning (trimmed for Telegram)
  if (data.fullResponse || data.reasoning) {
    const text = data.fullResponse || data.reasoning;
    const trimmed = text.length > 1200 ? text.slice(0, 1200) + "..." : text;
    parts.push(`\n🧠 <b>Analysis</b>\n<pre>${esc(trimmed)}</pre>`);
  }

  // Decision
  parts.push(`\n📋 <b>DECISION:</b> ${action} (${confidence}% confidence)`);
  if (data.tradeQueued) {
    const venue = data.executionVenue === "cex" ? `on ${esc(data.exchange || "CEX")}` : "via CoW Protocol";
    parts.push(`⚡ Trade queued: ${esc(data.tradeAction || data.action)} $${esc(data.tradeAmount || "?")} ${venue}`);
  }

  // Burn
  if (data.burnAmount || data.burnCostUsd) {
    parts.push(`🔥 Burned ${data.burnAmount || "?"} MONTRA (~$${Number(data.burnCostUsd || 0).toFixed(2)})`);
  }

  // Track record
  if (data.trackRecord) {
    parts.push(`📈 Track: ${esc(data.trackRecord)}`);
  }

  return parts.join("\n");
}

// ── Send a chat action (typing indicator) ───────────────────────────────────

export async function sendChatAction(
  chatId: number | string,
  action: "typing" | "upload_photo" | "upload_document" = "typing",
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    await fetch(`${TELEGRAM_API}${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // non-critical
  }
}

// ── HTML escape helper ──────────────────────────────────────────────────────

export function esc(s: string | number): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
