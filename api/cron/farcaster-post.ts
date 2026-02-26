/**
 * GET /api/cron/farcaster-post
 * Vercel cron job — runs every 5 minutes.
 * Queries Supabase for notable events and posts them to Farcaster via Neynar.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { getNeynar, getFarcasterConfig } from "../_lib/neynar.js";
import {
  castAgentDeployed,
  castPnlMilestone,
  castTradeMilestone,
  castBurnConfirmed,
  castAgentRegistered,
  castSentimentTradeFilled,
  castTokenDeployed,
} from "../_lib/cast-templates.js";

const MAX_POSTS_PER_RUN = 10;
const LOOKBACK_MINUTES = 6;

const PNL_THRESHOLDS = [10_000, 5_000, 1_000, 500, 100];
const TRADE_THRESHOLDS = [1_000, 500, 100, 50, 10];

interface CastEvent {
  event_type: string;
  event_key: string;
  cast_text: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET (Vercel cron sends GET)
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Auth gate — Vercel sets this header automatically for cron jobs
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check Farcaster env vars
  try {
    getFarcasterConfig();
  } catch {
    return res.status(503).json({ error: "Farcaster not configured" });
  }

  if (!process.env.NEYNAR_API_KEY) {
    return res.status(503).json({ error: "Neynar API key not configured" });
  }

  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString();

  // --- 1. Gather events in parallel ---
  const [agentsResult, allAgentsResult, burnsResult, registeredResult, sentimentFilledResult, tokenDeploysResult] = await Promise.allSettled([
    // New active agents
    supabase
      .from("agents")
      .select("id, config, status, erc8004_agent_id, updated_at")
      .eq("status", "active")
      .gte("updated_at", cutoff),
    // All agents for milestone checks
    supabase
      .from("agents")
      .select("id, config, stats"),
    // Confirmed burns
    supabase
      .from("burn_transactions")
      .select("id, amount, wallet_address, status, updated_at")
      .eq("status", "confirmed")
      .gte("updated_at", cutoff),
    // Newly ERC-8004 registered agents
    supabase
      .from("agents")
      .select("id, config, erc8004_agent_id, erc8004_registered_at")
      .not("erc8004_agent_id", "is", null)
      .gte("erc8004_registered_at", cutoff),
    // Filled sentiment trades
    supabase
      .from("sentiment_trades")
      .select("id, order_uid, sentiment_score, usdc_amount, montra_amount, filled_at")
      .eq("status", "filled")
      .gte("filled_at", cutoff),
    // Newly deployed tokens via Clawncher
    supabase
      .from("token_deployments")
      .select("id, token_name, token_symbol, token_address, deployer_wallet, deployed_at")
      .eq("status", "deployed")
      .gte("deployed_at", cutoff),
  ]);

  const events: CastEvent[] = [];

  // New agent deployments
  if (agentsResult.status === "fulfilled" && agentsResult.value.data) {
    for (const agent of agentsResult.value.data) {
      events.push({
        event_type: "agent_deployed",
        event_key: `agent_deployed:${agent.id}`,
        cast_text: castAgentDeployed(agent),
      });
    }
  }

  // P&L and trade milestones
  if (allAgentsResult.status === "fulfilled" && allAgentsResult.value.data) {
    for (const agent of allAgentsResult.value.data) {
      const pnl = agent.stats?.totalPnl ?? agent.stats?.total_pnl ?? 0;
      const trades = agent.stats?.totalTrades ?? agent.stats?.total_trades ?? 0;

      // Highest crossed PNL threshold
      for (const threshold of PNL_THRESHOLDS) {
        if (pnl >= threshold) {
          events.push({
            event_type: "pnl_milestone",
            event_key: `pnl_milestone:${agent.id}:${threshold}`,
            cast_text: castPnlMilestone(agent, threshold),
          });
          break; // only highest
        }
      }

      // Highest crossed trade threshold
      for (const threshold of TRADE_THRESHOLDS) {
        if (trades >= threshold) {
          events.push({
            event_type: "trade_milestone",
            event_key: `trade_milestone:${agent.id}:${threshold}`,
            cast_text: castTradeMilestone(agent, threshold),
          });
          break; // only highest
        }
      }
    }
  }

  // Confirmed burns
  if (burnsResult.status === "fulfilled" && burnsResult.value.data) {
    for (const burn of burnsResult.value.data) {
      events.push({
        event_type: "burn_confirmed",
        event_key: `burn_confirmed:${burn.id}`,
        cast_text: castBurnConfirmed(burn),
      });
    }
  }

  // ERC-8004 agent registrations
  if (registeredResult.status === "fulfilled" && registeredResult.value.data) {
    for (const agent of registeredResult.value.data) {
      events.push({
        event_type: "agent_registered",
        event_key: `agent_registered:${agent.id}:${agent.erc8004_agent_id}`,
        cast_text: castAgentRegistered(agent),
      });
    }
  }

  // Filled sentiment trades
  if (sentimentFilledResult.status === "fulfilled" && sentimentFilledResult.value.data) {
    for (const trade of sentimentFilledResult.value.data) {
      if (!trade.montra_amount) continue;
      events.push({
        event_type: "sentiment_trade_filled",
        event_key: `sentiment_trade_filled:${trade.id}`,
        cast_text: castSentimentTradeFilled(
          Number(trade.sentiment_score),
          Number(trade.usdc_amount),
          String(trade.montra_amount),
        ),
      });
    }
  }

  // Token deployments via Clawncher
  if (tokenDeploysResult.status === "fulfilled" && tokenDeploysResult.value.data) {
    for (const token of tokenDeploysResult.value.data) {
      if (!token.token_address) continue;
      events.push({
        event_type: "token_deployed",
        event_key: `token_deployed:${token.token_address}`,
        cast_text: castTokenDeployed({
          name: token.token_name,
          symbol: token.token_symbol,
          tokenAddress: token.token_address,
          deployerWallet: token.deployer_wallet,
        }),
      });
    }
  }

  if (events.length === 0) {
    return res.status(200).json({ processed: 0, posted: 0, failed: 0, skipped: 0 });
  }

  // --- 2. Deduplicate against farcaster_casts table ---
  const eventKeys = events.map((e) => e.event_key);
  const { data: existingCasts } = await supabase
    .from("farcaster_casts")
    .select("event_key")
    .in("event_key", eventKeys);

  const existingKeys = new Set((existingCasts || []).map((c: any) => c.event_key));
  const newEvents = events.filter((e) => !existingKeys.has(e.event_key));

  // Cap at MAX_POSTS_PER_RUN
  const toPost = newEvents.slice(0, MAX_POSTS_PER_RUN);
  const skipped = newEvents.length - toPost.length;

  // --- 3. Post sequentially ---
  const neynar = getNeynar();
  const { signerUuid } = getFarcasterConfig();
  let posted = 0;
  let failed = 0;

  for (const event of toPost) {
    // Pre-insert as pending
    const { error: insertError } = await supabase.from("farcaster_casts").insert({
      event_type: event.event_type,
      event_key: event.event_key,
      cast_text: event.cast_text,
      status: "pending",
    });

    // Unique constraint violation means another run already handled it
    if (insertError) {
      continue;
    }

    try {
      const result = await neynar.publishCast({
        signerUuid,
        text: event.cast_text,
      });

      await supabase
        .from("farcaster_casts")
        .update({
          status: "posted",
          cast_hash: result.cast?.hash || null,
          posted_at: new Date().toISOString(),
        })
        .eq("event_key", event.event_key);

      posted++;
    } catch (err: any) {
      console.error(`Failed to post cast [${event.event_key}]:`, err.message);

      await supabase
        .from("farcaster_casts")
        .update({
          status: "failed",
          error: err.message?.slice(0, 500) || "Unknown error",
        })
        .eq("event_key", event.event_key);

      failed++;
    }
  }

  return res.status(200).json({
    processed: toPost.length,
    posted,
    failed,
    skipped: skipped + existingKeys.size,
  });
}
