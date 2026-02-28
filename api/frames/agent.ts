/**
 * GET /api/frames/agent?id=<uuid> — Agent detail frame
 * POST /api/frames/agent — button handler (pause/resume)
 *
 * Shows a specific agent's stats: P&L, win rate, trades, status.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { sendFrame, buildImageSvg, frameUrl } from "./_lib/frame.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const agentId =
    (req.query.id as string) || req.body?.untrustedData?.state;

  if (!agentId) {
    return sendFrame(res, {
      imageUrl: buildImageSvg({
        title: "Agent Not Found",
        subtitle: "No agent ID provided",
        badge: "ERROR",
        accentColor: "#ef4444",
        stats: [],
      }),
      buttons: [
        { label: "Home", action: "post", target: frameUrl("home") },
      ],
    });
  }

  const supabase = getSupabase();

  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, config, stats, status, wallet_data, created_at")
    .eq("id", agentId)
    .single();

  if (error || !agent) {
    return sendFrame(res, {
      imageUrl: buildImageSvg({
        title: "Agent Not Found",
        subtitle: `ID: ${agentId.slice(0, 8)}...`,
        badge: "ERROR",
        accentColor: "#ef4444",
        stats: [],
      }),
      buttons: [
        { label: "Home", action: "post", target: frameUrl("home") },
      ],
    });
  }

  const config = agent.config || {};
  const stats = agent.stats || {};
  const name = config.name || agentId.slice(0, 8);
  const strategy = config.strategyId || config.strategy || "custom";
  const pnl = stats.pnlUsd || 0;
  const pnlPct = stats.pnlPct || 0;
  const winRate = stats.winRate || 0;
  const trades = stats.tradeCount || 0;
  const status = agent.status || "unknown";

  const statusColor: Record<string, string> = {
    active: "#10b981",
    paused: "#f59e0b",
    stopped: "#71717a",
    deploying: "#3b82f6",
    error: "#ef4444",
  };

  const imageUrl = buildImageSvg({
    title: `Agent: ${name}`,
    subtitle: `${strategy} strategy`,
    badge: status.toUpperCase(),
    accentColor: statusColor[status] || "#71717a",
    stats: [
      {
        label: "P&L",
        value: `$${pnl.toFixed(2)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%)`,
        color: pnl >= 0 ? "#10b981" : "#ef4444",
      },
      {
        label: "Win Rate",
        value: `${(winRate * 100).toFixed(1)}%`,
        color: winRate >= 0.5 ? "#10b981" : "#ef4444",
      },
      { label: "Total Trades", value: trades.toLocaleString() },
      {
        label: "Status",
        value: status.charAt(0).toUpperCase() + status.slice(1),
        color: statusColor[status] || "#71717a",
      },
    ],
  });

  sendFrame(res, {
    imageUrl,
    postUrl: frameUrl(`agent?id=${agentId}`),
    buttons: [
      { label: "Refresh", action: "post" },
      { label: "Home", action: "post", target: frameUrl("home") },
      {
        label: "View on Montra",
        action: "link",
        target: `https://montrafinance.com/agents`,
      },
    ],
  });
}
