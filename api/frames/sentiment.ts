/**
 * GET /api/frames/sentiment — Live sentiment gauge frame
 * POST /api/frames/sentiment — button handler
 *
 * Shows current Farcaster sentiment score, cast count, and recent trend.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { sendFrame, buildImageSvg, frameUrl } from "./_lib/frame.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle POST (button clicks)
  if (req.method === "POST") {
    const buttonIndex = req.body?.untrustedData?.buttonIndex;
    if (buttonIndex === 1) {
      // Refresh — just re-render the same frame with fresh data
    } else if (buttonIndex === 2) {
      return res.redirect(302, frameUrl("home"));
    } else if (buttonIndex === 3) {
      return res.redirect(302, "https://montrafinance.com/analytics");
    }
  }

  const supabase = getSupabase();

  // Latest snapshot + previous for trend
  const { data: snapshots } = await supabase
    .from("sentiment_snapshots")
    .select("avg_score, cast_count, created_at")
    .order("created_at", { ascending: false })
    .limit(2);

  const latest = snapshots?.[0];
  const previous = snapshots?.[1];

  const score = latest?.avg_score ?? 0;
  const castCount = latest?.cast_count ?? 0;
  const prevScore = previous?.avg_score ?? 0;
  const trend = score - prevScore;

  // Determine sentiment label
  let sentimentLabel: string;
  if (score >= 0.5) sentimentLabel = "Very Bullish";
  else if (score >= 0.2) sentimentLabel = "Bullish";
  else if (score >= -0.2) sentimentLabel = "Neutral";
  else if (score >= -0.5) sentimentLabel = "Bearish";
  else sentimentLabel = "Very Bearish";

  // Recent top casts
  const { data: recentCasts } = await supabase
    .from("farcaster_sentiment")
    .select("author_name, score")
    .order("analyzed_at", { ascending: false })
    .limit(3);

  const topCastsLine = (recentCasts || [])
    .map((c) => `@${c.author_name}: ${c.score > 0 ? "+" : ""}${c.score.toFixed(2)}`)
    .join("  |  ");

  const imageUrl = buildImageSvg({
    title: "Community Sentiment",
    subtitle: topCastsLine || "No recent casts",
    badge: sentimentLabel.toUpperCase(),
    accentColor: score >= 0 ? "#10b981" : "#ef4444",
    stats: [
      {
        label: "Score",
        value: score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2),
        color: score >= 0 ? "#10b981" : "#ef4444",
      },
      {
        label: "Trend",
        value: trend > 0 ? `+${trend.toFixed(2)}` : trend.toFixed(2),
        color: trend >= 0 ? "#10b981" : "#ef4444",
      },
      { label: "Casts Analyzed", value: castCount.toString() },
      {
        label: "Updated",
        value: latest?.created_at
          ? new Date(latest.created_at).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            }) + " UTC"
          : "—",
      },
    ],
  });

  sendFrame(res, {
    imageUrl,
    postUrl: frameUrl("sentiment"),
    buttons: [
      { label: "Refresh", action: "post" },
      { label: "Back", action: "post" },
      { label: "Full Analytics", action: "link", target: "https://montrafinance.com/analytics" },
    ],
  });
}
