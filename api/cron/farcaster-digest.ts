/**
 * GET /api/cron/farcaster-digest
 * Vercel cron job — runs weekly on Mondays at 14:00 UTC.
 * Publishes a weekly community engagement digest to Farcaster.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { getNeynar, getFarcasterConfig } from "../_lib/neynar.js";
import { queryMontraAI } from "../_lib/montra-ai.js";
import { castWeeklyDigest } from "../_lib/cast-templates.js";

const DIGEST_SYSTEM_PROMPT = `Write a brief weekly recap for Montra Finance's Farcaster.
Summarize the community engagement stats provided.
Keep it under 280 chars. Professional, one emoji max.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let signerUuid: string;
  try {
    ({ signerUuid } = getFarcasterConfig());
  } catch {
    return res.status(503).json({ error: "Farcaster not configured" });
  }

  if (!process.env.NEYNAR_API_KEY) {
    return res.status(503).json({ error: "Neynar API key not configured" });
  }

  const supabase = getSupabase();
  const neynar = getNeynar();

  // --- 1. Query last 7 days of replies ---
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  const { data: weekReplies } = await supabase
    .from("farcaster_replies")
    .select("author_fid, author_name, mention_text, reply_text, topic, replied_at")
    .eq("status", "replied")
    .gte("replied_at", weekAgo);

  const replies = weekReplies || [];
  if (replies.length === 0) {
    return res.status(200).json({ posted: false, reason: "No replies this week" });
  }

  // --- 2. Compute stats ---
  const totalReplies = replies.length;
  const uniqueAuthors = new Set(replies.map((r: any) => r.author_fid)).size;

  // Topic breakdown
  const topicCounts = new Map<string, number>();
  for (const r of replies) {
    const t = (r as any).topic || "other";
    topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
  }
  const topTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic, count]) => `${topic}: ${count}`)
    .join(", ");

  // Sample recent questions
  const sampleQuestions = replies
    .slice(-3)
    .map((r: any) => (r.mention_text || "").slice(0, 80))
    .filter(Boolean);

  // --- 3. Generate digest with AI ---
  const userPrompt = `Weekly stats:
- Total replies: ${totalReplies}
- Unique community members: ${uniqueAuthors}
- Top topics: ${topTopics || "general"}
- Sample questions: ${sampleQuestions.map((q: string) => `"${q}"`).join(", ") || "various crypto topics"}

Write the weekly recap cast.`;

  let digestText: string;
  try {
    digestText = await queryMontraAI(DIGEST_SYSTEM_PROMPT, userPrompt);
    digestText = digestText.trim();
    if (!digestText || digestText.length > 320) {
      throw new Error("AI digest too long or empty");
    }
  } catch {
    // Fallback to template
    digestText = castWeeklyDigest(totalReplies, uniqueAuthors);
  }

  // --- 4. Deduplicate via farcaster_casts ---
  const eventKey = `weekly_digest:${new Date().toISOString().slice(0, 10)}`;
  const { error: insertError } = await supabase.from("farcaster_casts").insert({
    event_type: "weekly_digest",
    event_key: eventKey,
    cast_text: digestText,
    status: "pending",
  });

  if (insertError) {
    return res.status(200).json({ posted: false, reason: "Already posted this week" });
  }

  // --- 5. Publish ---
  try {
    const result = await neynar.publishCast({
      signerUuid,
      text: digestText,
    });

    await supabase
      .from("farcaster_casts")
      .update({
        status: "posted",
        cast_hash: result.cast?.hash || null,
        posted_at: new Date().toISOString(),
      })
      .eq("event_key", eventKey);

    return res.status(200).json({ posted: true, castHash: result.cast?.hash });
  } catch (err: any) {
    console.error("[farcaster-digest] publishCast failed:", err.message);

    await supabase
      .from("farcaster_casts")
      .update({
        status: "failed",
        error: err.message?.slice(0, 500) || "Unknown error",
      })
      .eq("event_key", eventKey);

    return res.status(500).json({ posted: false, error: err.message });
  }
}
