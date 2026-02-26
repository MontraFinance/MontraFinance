/**
 * GET /api/cron/farcaster-sentiment
 * Vercel cron job — runs every 5 minutes.
 * Searches Farcaster for $MONTRA / Montra Finance mentions,
 * scores sentiment, and stores results in Supabase.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { getNeynar } from "../_lib/neynar.js";
import { scoreCast, averageSentiment } from "../_lib/sentiment.js";

const SEARCH_QUERIES = ["$MONTRA", "Montra Finance", "montrafinance"];
const MAX_CASTS_PER_QUERY = 25;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!process.env.NEYNAR_API_KEY) {
    return res.status(503).json({ error: "Neynar API key not configured" });
  }

  const supabase = getSupabase();
  const neynar = getNeynar();

  // --- 1. Search Farcaster for mentions ---
  const castMap = new Map<string, any>();

  const searchResults = await Promise.allSettled(
    SEARCH_QUERIES.map((q) =>
      neynar.searchCasts({ q, limit: MAX_CASTS_PER_QUERY }),
    ),
  );

  for (const result of searchResults) {
    if (result.status !== "fulfilled") continue;
    const val = result.value as any;
    const casts = val?.casts || val?.result?.casts || [];
    for (const cast of casts) {
      if (cast.hash && !castMap.has(cast.hash)) {
        castMap.set(cast.hash, cast);
      }
    }
  }

  if (castMap.size === 0) {
    return res.status(200).json({ casts_analyzed: 0, avg_sentiment: 0, new_casts: 0 });
  }

  // --- 2. Deduplicate against existing records ---
  const hashes = Array.from(castMap.keys());
  const { data: existing } = await supabase
    .from("farcaster_sentiment")
    .select("cast_hash")
    .in("cast_hash", hashes);

  const existingHashes = new Set((existing || []).map((r: any) => r.cast_hash));
  const newCasts = Array.from(castMap.entries()).filter(
    ([hash]) => !existingHashes.has(hash),
  );

  // --- 3. Score and insert new casts ---
  const scores: number[] = [];
  let inserted = 0;

  for (const [hash, cast] of newCasts) {
    const text = cast.text || "";
    const likes = cast.reactions?.likes_count ?? cast.reactions?.likes?.length ?? 0;
    const recasts = cast.reactions?.recasts_count ?? cast.reactions?.recasts?.length ?? 0;
    const score = scoreCast(text, likes, recasts);
    scores.push(score);

    const { error } = await supabase.from("farcaster_sentiment").insert({
      cast_hash: hash,
      author_fid: cast.author?.fid || null,
      author_name: cast.author?.username || cast.author?.display_name || null,
      cast_text: text.slice(0, 1000),
      score,
      likes,
      recasts,
    });

    if (!error) inserted++;
  }

  // --- 4. Compute rolling aggregate and store snapshot ---
  const allScores = [...scores];

  // Also include recent scores from DB for rolling window
  const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data: recentScores } = await supabase
    .from("farcaster_sentiment")
    .select("score")
    .gte("analyzed_at", oneHourAgo);

  if (recentScores) {
    for (const r of recentScores) {
      allScores.push(Number(r.score));
    }
  }

  const avgScore = averageSentiment(allScores);

  await supabase.from("sentiment_snapshots").insert({
    avg_score: avgScore,
    cast_count: allScores.length,
    window_minutes: 60,
  });

  return res.status(200).json({
    casts_analyzed: castMap.size,
    new_casts: inserted,
    avg_sentiment: avgScore,
    total_in_window: allScores.length,
  });
}
