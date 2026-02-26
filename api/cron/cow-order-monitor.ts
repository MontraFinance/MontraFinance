/**
 * GET /api/cron/cow-order-monitor
 * Vercel cron job — runs every 2 minutes.
 * Polls pending/open CoW Protocol orders and updates their status.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { getCowOrderStatus } from "../_lib/cow.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = getSupabase();

  // Fetch all open/pending orders
  const { data: orders, error } = await supabase
    .from("cow_orders")
    .select("*")
    .in("status", ["pending", "open"]);

  if (error || !orders || orders.length === 0) {
    return res.status(200).json({ checked: 0, updated: 0 });
  }

  let updated = 0;

  for (const order of orders) {
    if (!order.order_uid) continue;

    try {
      const status = await getCowOrderStatus(order.order_uid);

      // Map CoW status to our status
      let newStatus = order.status;
      const updateFields: Record<string, any> = {};

      if (status.status === "fulfilled" || status.executedBuyAmount) {
        newStatus = "filled";
        updateFields.buy_amount_actual = status.executedBuyAmount || null;
        updateFields.filled_at = new Date().toISOString();

        // Calculate savings (difference between actual and minimum)
        if (status.executedBuyAmount && order.buy_amount_min) {
          const actual = BigInt(status.executedBuyAmount);
          const minimum = BigInt(order.buy_amount_min);
          if (actual > minimum) {
            updateFields.savings_usd = Number(actual - minimum) / 1e18;
          }
        }
      } else if (status.status === "expired" || status.invalidated) {
        newStatus = status.invalidated ? "cancelled" : "expired";
      } else if (status.status === "open" && order.status === "pending") {
        newStatus = "open";
      }

      if (newStatus !== order.status) {
        updateFields.status = newStatus;
        await supabase
          .from("cow_orders")
          .update(updateFields)
          .eq("id", order.id);
        updated++;
      }
    } catch (err: any) {
      console.error(`Failed to check order ${order.order_uid}:`, err.message);
    }
  }

  // ── Monitor buyback orders ──
  let buybacksChecked = 0;
  let buybacksUpdated = 0;

  try {
    const { data: buybacks } = await supabase
      .from("buyback_orders")
      .select("*")
      .in("status", ["pending", "open"]);

    buybacksChecked = (buybacks || []).length;

    for (const bb of buybacks || []) {
      if (!bb.order_uid) continue;
      try {
        const status = await getCowOrderStatus(bb.order_uid);
        const updates: Record<string, any> = {};

        if (status.status === "fulfilled" || status.executedBuyAmount) {
          updates.status = "filled";
          updates.montra_amount = status.executedBuyAmount || null;
          updates.filled_at = new Date().toISOString();

          // Calculate MEV savings
          if (status.executedBuyAmount && bb.cow_quote_data?.quote?.buyAmount) {
            const actual = BigInt(status.executedBuyAmount);
            const minimum = BigInt(bb.cow_quote_data.quote.buyAmount);
            if (actual > minimum) {
              updates.savings_usd = Number(actual - minimum) / 1e18;
            }
          }
        } else if (status.status === "expired" || status.invalidated) {
          updates.status = "failed";
          updates.error_message = status.invalidated ? "Order invalidated" : "Order expired";
        } else if (status.status === "open" && bb.status === "pending") {
          updates.status = "open";
        }

        if (Object.keys(updates).length > 0 && updates.status !== bb.status) {
          await supabase.from("buyback_orders").update(updates).eq("id", bb.id);
          buybacksUpdated++;
        }
      } catch (err: any) {
        console.error(`Failed to check buyback ${bb.order_uid}:`, err.message);
      }
    }
  } catch {
    // buyback_orders table may not exist yet — that's fine
  }

  // ── Monitor sentiment trades ──
  let sentimentChecked = 0;
  let sentimentUpdated = 0;

  try {
    const { data: sentimentTrades } = await supabase
      .from("sentiment_trades")
      .select("*")
      .in("status", ["pending", "open"]);

    sentimentChecked = (sentimentTrades || []).length;

    for (const st of sentimentTrades || []) {
      if (!st.order_uid) continue;
      try {
        const status = await getCowOrderStatus(st.order_uid);
        const updates: Record<string, any> = {};

        if (status.status === "fulfilled" || status.executedBuyAmount) {
          updates.status = "filled";
          updates.montra_amount = status.executedBuyAmount || null;
          updates.filled_at = new Date().toISOString();
        } else if (status.status === "expired" || status.invalidated) {
          updates.status = "failed";
          updates.error_message = status.invalidated ? "Order invalidated" : "Order expired";
        } else if (status.status === "open" && st.status === "pending") {
          updates.status = "open";
        }

        if (Object.keys(updates).length > 0 && updates.status !== st.status) {
          await supabase.from("sentiment_trades").update(updates).eq("id", st.id);
          sentimentUpdated++;
        }
      } catch (err: any) {
        console.error(`Failed to check sentiment trade ${st.order_uid}:`, err.message);
      }
    }
  } catch {
    // sentiment_trades table may not exist yet — that's fine
  }

  return res.status(200).json({
    checked: orders.length,
    updated,
    buybacksChecked,
    buybacksUpdated,
    sentimentChecked,
    sentimentUpdated,
  });
}
