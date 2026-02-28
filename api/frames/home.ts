/**
 * GET /api/frames/home — Montra Finance landing frame
 * POST /api/frames/home — button handler (navigate to sub-frames)
 *
 * Shows protocol overview: total agents, total burns, sentiment score.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { sendFrame, buildImageSvg, frameUrl } from "./_lib/frame.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabase();

  // Fetch protocol stats in parallel
  const [agentsResult, burnsResult, sentimentResult] = await Promise.all([
    supabase.from("agents").select("id, status", { count: "exact" }),
    supabase
      .from("burn_transactions")
      .select("amount_burned")
      .in("status", ["confirmed", "processed"]),
    supabase
      .from("sentiment_snapshots")
      .select("avg_score, cast_count")
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const totalAgents = agentsResult.count || 0;
  const activeAgents = (agentsResult.data || []).filter(
    (a) => a.status === "active",
  ).length;
  const totalBurned = (burnsResult.data || []).reduce(
    (sum, r) => sum + (r.amount_burned || 0),
    0,
  );
  const sentimentScore = sentimentResult.data?.avg_score ?? 0;

  // Handle POST (button clicks) — route to sub-frames
  if (req.method === "POST") {
    const body = req.body || {};
    const buttonIndex = body.untrustedData?.buttonIndex;

    if (buttonIndex === 1) {
      return res.redirect(302, frameUrl("sentiment"));
    }
    if (buttonIndex === 2) {
      return res.redirect(302, frameUrl("burns"));
    }
    if (buttonIndex === 3) {
      return res.redirect(302, "https://montrafinance.com/agents");
    }
  }

  // Build frame image
  const imageUrl = buildImageSvg({
    title: "Montra Finance",
    subtitle: "Autonomous AI Trading on Base",
    badge: "PROTOCOL OVERVIEW",
    stats: [
      { label: "Total Agents", value: totalAgents.toString() },
      {
        label: "Active Agents",
        value: activeAgents.toString(),
        color: "#10b981",
      },
      {
        label: "Total Burned",
        value: `${totalBurned.toLocaleString()} $MONTRA`,
        color: "#f59e0b",
      },
      {
        label: "Sentiment",
        value:
          sentimentScore > 0
            ? `+${sentimentScore.toFixed(2)}`
            : sentimentScore.toFixed(2),
        color: sentimentScore > 0 ? "#10b981" : "#ef4444",
      },
    ],
  });

  sendFrame(res, {
    imageUrl,
    postUrl: frameUrl("home"),
    buttons: [
      { label: "Sentiment", action: "post" },
      { label: "Burn Stats", action: "post" },
      {
        label: "Open App",
        action: "link",
        target: "https://montrafinance.com/agents",
      },
    ],
  });
}
