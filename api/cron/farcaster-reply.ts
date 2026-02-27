/**
 * GET /api/cron/farcaster-reply
 * Vercel cron job — runs every 3 minutes.
 * Fetches @montrafinance mentions on Farcaster, generates AI replies,
 * and posts them as threaded replies.
 *
 * Features:
 * - BTC + ETH market prices in context
 * - Trending Base tokens from DexScreener
 * - Conversation memory for follow-ups
 * - Auto-like every mention
 * - Auto-follow mentioning users
 * - Dashboard link for Montra-related questions
 * - Topic categorization for analytics
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { getNeynar, getFarcasterConfig } from "../_lib/neynar.js";
import { queryMontraAI } from "../_lib/montra-ai.js";

const MAX_REPLIES_PER_RUN = 5;
const COOLDOWN_MINUTES = 30;
const COOLDOWN_MAX_REPLIES = 3;
const MAX_REPLY_LENGTH = 300;
const TIME_GUARD_MS = 45_000;

const SYSTEM_PROMPT = `You are Montra Finance's assistant on Farcaster.
Rules:
- Give brief, helpful answers about crypto markets, DeFi, and trading concepts.
- You may mention Montra Finance is an autonomous trading platform on Base.
- Do NOT reveal agent names, P&L, internal stats, user data, or wallet addresses.
- Do NOT give financial advice. Use "historically", "some traders think", etc.
- Keep reply under 280 characters. Be concise and direct.
- Professional but friendly. One emoji max.
- If unsure, say so briefly. If spam/hostile, reply with brief neutral acknowledgment.`;

interface TrendingToken {
  symbol: string;
  priceChange24h: number;
}

/** Fetch ETH and BTC prices from DexScreener for market context */
async function fetchMarketPrices(): Promise<{ ethUsd?: number; btcUsd?: number }> {
  try {
    const [ethResp, btcResp] = await Promise.allSettled([
      fetch(
        "https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006",
        { signal: AbortSignal.timeout(5000) },
      ),
      fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
        { signal: AbortSignal.timeout(5000) },
      ),
    ]);

    let ethUsd: number | undefined;
    if (ethResp.status === "fulfilled" && ethResp.value.ok) {
      const data = await ethResp.value.json();
      const pairs = (data.pairs || []).filter((p: any) => p.chainId === "base");
      ethUsd = pairs.length > 0 ? parseFloat(pairs[0].priceUsd) : undefined;
    }

    let btcUsd: number | undefined;
    if (btcResp.status === "fulfilled" && btcResp.value.ok) {
      const data = await btcResp.value.json();
      btcUsd = data.bitcoin?.usd;
    }

    return { ethUsd, btcUsd };
  } catch {
    return {};
  }
}

/** Fetch top 3 trending tokens on Base by 24h volume from DexScreener */
async function fetchTrendingTokens(): Promise<TrendingToken[]> {
  try {
    const resp = await fetch(
      "https://api.dexscreener.com/latest/dex/search?q=base",
      { signal: AbortSignal.timeout(5000) },
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    const pairs = (data.pairs || [])
      .filter((p: any) => p.chainId === "base" && p.baseToken?.symbol && p.volume?.h24)
      .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      .slice(0, 3);

    return pairs.map((p: any) => ({
      symbol: p.baseToken.symbol,
      priceChange24h: parseFloat(p.priceChange?.h24 || "0"),
    }));
  } catch {
    return [];
  }
}

/** Detect topic from mention text for analytics */
function detectTopic(text: string): string {
  const lower = text.toLowerCase();
  if (/\bmontra\b/.test(lower)) return "montra";
  if (/\bbtc\b|\bbitcoin\b/.test(lower)) return "btc";
  if (/\beth\b|\bethereum\b/.test(lower)) return "eth";
  if (/\bdefi\b|\byield\b|\bliquidity\b|\bpool\b|\blend\b/.test(lower)) return "defi";
  if (/\btrad(e|ing)\b|\blong\b|\bshort\b|\bleverage\b|\bfutures\b/.test(lower)) return "trading";
  return "other";
}

/** Basic spam filter — returns true if the mention looks spammy */
function isSpam(text: string): boolean {
  if (!text || text.trim().length < 5) return true;
  // Excessive URLs (3+)
  const urlCount = (text.match(/https?:\/\//g) || []).length;
  if (urlCount >= 3) return true;
  // All caps (ignoring short texts)
  const stripped = text.replace(/@\w+/g, "").trim();
  if (stripped.length > 10 && stripped === stripped.toUpperCase()) return true;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let fid: number;
  let signerUuid: string;
  try {
    ({ fid, signerUuid } = getFarcasterConfig());
  } catch {
    return res.status(503).json({ error: "Farcaster not configured" });
  }

  if (!process.env.NEYNAR_API_KEY) {
    return res.status(503).json({ error: "Neynar API key not configured" });
  }

  const supabase = getSupabase();
  const neynar = getNeynar();
  const startTime = Date.now();

  // --- 1. Fetch mentions ---
  let notifications: any[];
  try {
    const result = await neynar.fetchAllNotifications({
      fid,
      type: ["mentions" as any],
      limit: 25,
    });
    notifications = result.notifications || [];
  } catch (err: any) {
    console.error("[farcaster-reply] Failed to fetch notifications:", err.message);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }

  // Filter to mention-type only (safety check) and extract cast data
  const mentions = notifications
    .filter((n: any) => n.type === "mention" && n.cast)
    .map((n: any) => n.cast);

  if (mentions.length === 0) {
    return res.status(200).json({ processed: 0, replied: 0, skipped: 0, failed: 0 });
  }

  // --- 2. Filter out own casts and already-replied mentions ---
  const mentionHashes = mentions.map((c: any) => c.hash);
  const { data: existingReplies } = await supabase
    .from("farcaster_replies")
    .select("mention_hash")
    .in("mention_hash", mentionHashes);

  const alreadyReplied = new Set((existingReplies || []).map((r: any) => r.mention_hash));

  const pending = mentions.filter((cast: any) => {
    if (cast.author?.fid === fid) return false;
    if (alreadyReplied.has(cast.hash)) return false;
    if (isSpam(cast.text || "")) return false;
    return true;
  });

  // --- 2b. Engagement: Like every valid mention + auto-follow ---
  for (const cast of pending) {
    // Like the mention
    try {
      await neynar.publishReaction({
        signerUuid,
        reactionType: "like" as any,
        target: cast.hash,
      });
    } catch {
      // Non-critical — silently continue
    }

    // Auto-follow the user (skip our own FID)
    if (cast.author?.fid && cast.author.fid !== fid) {
      try {
        await neynar.followUser({
          signerUuid,
          targetFids: [cast.author.fid],
        });
      } catch {
        // Non-critical — Neynar handles already-followed silently
      }
    }
  }

  // --- 3. Per-author cooldown check ---
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_MINUTES * 60_000).toISOString();
  const authorFids = Array.from(new Set(pending.map((c: any) => c.author?.fid).filter(Boolean)));

  const cooledDownAuthors = new Set<number>();
  if (authorFids.length > 0) {
    const { data: recentAuthorReplies } = await supabase
      .from("farcaster_replies")
      .select("author_fid")
      .in("author_fid", authorFids)
      .gte("replied_at", cooldownCutoff)
      .eq("status", "replied");

    // Count replies per author in the cooldown window
    const replyCounts = new Map<number, number>();
    for (const r of recentAuthorReplies || []) {
      const fid = Number(r.author_fid);
      replyCounts.set(fid, (replyCounts.get(fid) || 0) + 1);
    }
    replyCounts.forEach((count, authorFid) => {
      if (count >= COOLDOWN_MAX_REPLIES) {
        cooledDownAuthors.add(authorFid);
      }
    });
  }

  const toReply = pending
    .filter((cast: any) => !cooledDownAuthors.has(cast.author?.fid))
    .slice(0, MAX_REPLIES_PER_RUN);

  if (toReply.length === 0) {
    return res.status(200).json({ processed: 0, replied: 0, skipped: pending.length, failed: 0 });
  }

  // --- 4. Fetch market prices + trending tokens once ---
  const [prices, trending] = await Promise.all([
    fetchMarketPrices(),
    fetchTrendingTokens(),
  ]);

  // --- 5. Reply loop ---
  let replied = 0;
  let failed = 0;
  let skipped = 0;

  for (const cast of toReply) {
    // Time guard
    if (Date.now() - startTime > TIME_GUARD_MS) {
      console.log("[farcaster-reply] Time guard hit, breaking early");
      break;
    }

    const mentionText = (cast.text || "").slice(0, 500);
    const authorFid = cast.author?.fid;
    const authorName = cast.author?.username || cast.author?.display_name || "unknown";

    // Build market context
    const priceParts: string[] = [];
    if (prices.ethUsd) priceParts.push(`ETH: ~$${prices.ethUsd.toFixed(0)}`);
    if (prices.btcUsd) priceParts.push(`BTC: ~$${prices.btcUsd.toFixed(0)}`);
    const marketCtx = priceParts.length > 0
      ? `Current prices: ${priceParts.join(", ")}.`
      : "Market prices unavailable.";

    // Trending tokens context
    let trendingCtx = "";
    if (trending.length > 0) {
      const tokenStrs = trending.map(
        (t) => `${t.symbol} (${t.priceChange24h >= 0 ? "+" : ""}${t.priceChange24h.toFixed(1)}%)`,
      );
      trendingCtx = `\nTrending on Base: ${tokenStrs.join(", ")}.`;
    }

    // Conversation memory — check if this is a follow-up to our own reply
    let conversationCtx = "";
    if (cast.parent_hash) {
      const { data: prevReply } = await supabase
        .from("farcaster_replies")
        .select("mention_text, reply_text")
        .eq("reply_hash", cast.parent_hash)
        .single();

      if (prevReply) {
        conversationCtx = `\nPrevious exchange:
User asked: "${(prevReply.mention_text || "").slice(0, 200)}"
You replied: "${(prevReply.reply_text || "").slice(0, 200)}"
This is a follow-up to that conversation.`;
      }
    }

    const userPrompt = `${marketCtx}${trendingCtx}${conversationCtx}

A user (@${authorName}) mentioned you on Farcaster:
"${mentionText}"

Reply briefly and helpfully.`;

    // Call Montra AI
    let aiReply: string;
    try {
      aiReply = await queryMontraAI(SYSTEM_PROMPT, userPrompt);
    } catch (err: any) {
      console.error(`[farcaster-reply] AI failed for ${cast.hash}:`, err.message);
      skipped++;
      continue; // skip — will retry next run
    }

    aiReply = aiReply.trim();
    if (!aiReply) {
      skipped++;
      continue;
    }

    // Append dashboard link for Montra-related mentions
    if (/montra/i.test(mentionText)) {
      const withLink = aiReply + "\n\nExplore more: montrafinance.com";
      if (withLink.length <= MAX_REPLY_LENGTH) {
        aiReply = withLink;
      }
    }

    // Truncate to max length
    if (aiReply.length > MAX_REPLY_LENGTH) {
      aiReply = aiReply.slice(0, MAX_REPLY_LENGTH - 1) + "…";
    }

    // Detect topic for analytics
    const topic = detectTopic(mentionText);

    // Insert as pending
    const { error: insertError } = await supabase.from("farcaster_replies").insert({
      mention_hash: cast.hash,
      mention_text: mentionText,
      author_fid: authorFid,
      author_name: authorName,
      reply_text: aiReply,
      status: "pending",
      topic,
    });

    // Unique constraint violation — another invocation handled it
    if (insertError) {
      skipped++;
      continue;
    }

    // Publish reply
    try {
      const result = await neynar.publishCast({
        signerUuid,
        text: aiReply,
        parent: cast.hash,
      });

      await supabase
        .from("farcaster_replies")
        .update({
          status: "replied",
          reply_hash: result.cast?.hash || null,
          replied_at: new Date().toISOString(),
        })
        .eq("mention_hash", cast.hash);

      replied++;
      console.log(`[farcaster-reply] Replied to ${cast.hash} from @${authorName} [${topic}]`);
    } catch (err: any) {
      console.error(`[farcaster-reply] publishCast failed for ${cast.hash}:`, err.message);

      await supabase
        .from("farcaster_replies")
        .update({
          status: "failed",
          error: err.message?.slice(0, 500) || "Unknown error",
        })
        .eq("mention_hash", cast.hash);

      failed++;
    }
  }

  return res.status(200).json({
    processed: toReply.length,
    replied,
    failed,
    skipped: skipped + cooledDownAuthors.size,
  });
}
