/**
 * GET /api/frames/burns — Burn stats frame
 * POST /api/frames/burns — button handler
 *
 * Shows total $MONTRA burned, user burns, buyback burns.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { sendFrame, buildImageSvg, frameUrl } from "./_lib/frame.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle POST (button clicks)
  if (req.method === "POST") {
    const buttonIndex = req.body?.untrustedData?.buttonIndex;
    if (buttonIndex === 1) {
      // Refresh
    } else if (buttonIndex === 2) {
      return res.redirect(302, frameUrl("home"));
    } else if (buttonIndex === 3) {
      return res.redirect(302, "https://montrafinance.com/transactions");
    }
  }

  const supabase = getSupabase();

  // Fetch burn data in parallel
  const [userBurnsResult, buybackResult] = await Promise.all([
    supabase
      .from("burn_transactions")
      .select("amount_burned")
      .in("status", ["confirmed", "processed"]),
    supabase
      .from("buyback_orders")
      .select("montra_burned, usdc_amount")
      .eq("status", "filled")
      .gt("montra_burned", 0)
      .then((r) => r)
      .catch(() => ({ data: null })),
  ]);

  const userBurns = userBurnsResult.data || [];
  const totalUserBurned = userBurns.reduce(
    (sum, r) => sum + (r.amount_burned || 0),
    0,
  );

  const buybackBurns = (buybackResult as any).data || [];
  const totalBuybackBurned = buybackBurns.reduce(
    (sum: number, r: any) => sum + (r.montra_burned || 0),
    0,
  );
  const totalBuybackUsdc = buybackBurns.reduce(
    (sum: number, r: any) => sum + (r.usdc_amount || 0),
    0,
  );

  const totalBurned = totalUserBurned + totalBuybackBurned;

  const imageUrl = buildImageSvg({
    title: "$MONTRA Burn Stats",
    subtitle: "Deflationary token burns on Base",
    badge: "BURN TRACKER",
    accentColor: "#f59e0b",
    stats: [
      {
        label: "Total Burned",
        value: totalBurned.toLocaleString(),
        color: "#f59e0b",
      },
      {
        label: "User Burns",
        value: `${totalUserBurned.toLocaleString()} (${userBurns.length} txns)`,
      },
      {
        label: "Buyback Burns",
        value: `${totalBuybackBurned.toLocaleString()} (${buybackBurns.length} txns)`,
      },
      {
        label: "Buyback Volume",
        value: `$${totalBuybackUsdc.toLocaleString()} USDC`,
        color: "#3b82f6",
      },
    ],
  });

  sendFrame(res, {
    imageUrl,
    postUrl: frameUrl("burns"),
    buttons: [
      { label: "Refresh", action: "post" },
      { label: "Back", action: "post" },
      { label: "View Transactions", action: "link", target: "https://montrafinance.com/transactions" },
    ],
  });
}
