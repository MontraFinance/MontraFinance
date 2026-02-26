/**
 * GET /api/cron/xmtp-alerts
 * Vercel cron — runs every 5 minutes.
 * Checks for PnL milestone crossings and sends XMTP alerts to subscribers.
 * Deduplicates via xmtp_alerts_sent table (same pattern as farcaster_casts).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { sendXmtpMessage, formatAlert } from "../_lib/xmtp.js";

const PNL_THRESHOLDS = [10_000, 5_000, 1_000, 500, 100];
const MAX_ALERTS_PER_RUN = 20;

interface AlertEvent {
  event_key: string;
  event_type: string;
  agent_id: string;
  message: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!process.env.XMTP_BOT_PRIVATE_KEY) {
    return res.status(503).json({ error: "XMTP not configured" });
  }

  const supabase = getSupabase();

  // Fetch all agents with stats
  const { data: agents, error: agentsErr } = await supabase
    .from("agents")
    .select("id, config, stats, status");

  if (agentsErr || !agents || agents.length === 0) {
    return res.status(200).json({ processed: 0, sent: 0, skipped: 0 });
  }

  // Build milestone events
  const events: AlertEvent[] = [];

  for (const agent of agents) {
    if (agent.status !== "active") continue;

    const pnl = agent.stats?.pnlUsd ?? 0;
    const agentName = agent.config?.name || agent.id.slice(0, 8);

    // Find highest crossed PnL threshold
    for (const threshold of PNL_THRESHOLDS) {
      if (pnl >= threshold) {
        events.push({
          event_key: `pnl_milestone:${agent.id}:${threshold}`,
          event_type: "milestone",
          agent_id: agent.id,
          message: formatAlert("milestone", {
            agentName,
            milestone: `$${threshold.toLocaleString()} P&L`,
            pnl: `$${pnl.toFixed(2)}`,
          }),
        });
        break; // Only highest threshold
      }
    }
  }

  if (events.length === 0) {
    return res.status(200).json({ processed: 0, sent: 0, skipped: 0 });
  }

  // Deduplicate against xmtp_alerts_sent
  const eventKeys = events.map((e) => e.event_key);
  const { data: existing } = await supabase
    .from("xmtp_alerts_sent")
    .select("event_key")
    .in("event_key", eventKeys);

  const existingKeys = new Set((existing || []).map((e: any) => e.event_key));
  const newEvents = events.filter((e) => !existingKeys.has(e.event_key));
  const toSend = newEvents.slice(0, MAX_ALERTS_PER_RUN);

  let sent = 0;
  let failed = 0;

  for (const event of toSend) {
    // Mark as sent first (prevents duplicate sends from concurrent runs)
    const { error: insertErr } = await supabase.from("xmtp_alerts_sent").insert({
      event_key: event.event_key,
      event_type: event.event_type,
      agent_id: event.agent_id,
    });

    if (insertErr) continue; // Already handled by another run

    // Fetch subscribers for this agent
    const { data: subs } = await supabase
      .from("xmtp_subscriptions")
      .select("wallet_address, alert_types")
      .eq("agent_id", event.agent_id)
      .eq("enabled", true);

    if (!subs || subs.length === 0) continue;

    for (const sub of subs) {
      if (sub.alert_types && !sub.alert_types.includes("milestone")) continue;

      const result = await sendXmtpMessage(sub.wallet_address, event.message);
      if (result.sent) {
        sent++;
      } else {
        failed++;
      }
    }
  }

  return res.status(200).json({
    processed: toSend.length,
    sent,
    failed,
    skipped: existingKeys.size + (newEvents.length - toSend.length),
  });
}
