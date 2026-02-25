/**
 * GET /api/revenue/stats
 *
 * Public revenue transparency endpoint — returns aggregated USDC revenue
 * from x402 micropayments and buyback flywheel stats.
 * No wallet auth required (transparency data).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCorsHeaders } from "../_lib/cors.js";
import { checkRateLimit } from "../_lib/rate-limit.js";
import { getSupabase } from "../_lib/supabase.js";

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || "unknown";
  const { allowed } = checkRateLimit(ip, 30);
  if (!allowed) return res.status(429).json({ error: "Rate limited" });

  try {
    const supabase = getSupabase();
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 3600_000).toISOString();
    const d7 = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 24 * 3600_000).toISOString();
    const d90 = new Date(now.getTime() - 90 * 24 * 3600_000).toISOString();

    // ── All-time totals ──
    const { data: allPayments } = await supabase
      .from("x402_payments")
      .select("amount_usdc, endpoint, payer_address, created_at");

    const rows = allPayments || [];
    const totalRevenue = rows.reduce((s, r) => s + Number(r.amount_usdc), 0);
    const totalPayments = rows.length;
    const avgPayment = totalPayments > 0 ? totalRevenue / totalPayments : 0;

    // Unique payers
    const uniquePayers = new Set(rows.map((r) => r.payer_address)).size;

    // ── Time-windowed totals ──
    const revenue24h = rows
      .filter((r) => r.created_at >= h24)
      .reduce((s, r) => s + Number(r.amount_usdc), 0);
    const revenue7d = rows
      .filter((r) => r.created_at >= d7)
      .reduce((s, r) => s + Number(r.amount_usdc), 0);
    const revenue30d = rows
      .filter((r) => r.created_at >= d30)
      .reduce((s, r) => s + Number(r.amount_usdc), 0);

    // ── By-endpoint breakdown ──
    const endpointMap: Record<string, { total: number; count: number }> = {};
    for (const r of rows) {
      const key = r.endpoint;
      if (!endpointMap[key]) endpointMap[key] = { total: 0, count: 0 };
      endpointMap[key].total += Number(r.amount_usdc);
      endpointMap[key].count += 1;
    }
    const byEndpoint = Object.entries(endpointMap)
      .map(([endpoint, v]) => ({ endpoint, total: Math.round(v.total * 1e6) / 1e6, count: v.count }))
      .sort((a, b) => b.total - a.total);

    // ── Daily revenue series (last 90 days) ──
    const dailyMap: Record<string, { revenue: number; count: number }> = {};
    const recent90 = rows.filter((r) => r.created_at >= d90);
    for (const r of recent90) {
      const day = r.created_at.slice(0, 10); // "YYYY-MM-DD"
      if (!dailyMap[day]) dailyMap[day] = { revenue: 0, count: 0 };
      dailyMap[day].revenue += Number(r.amount_usdc);
      dailyMap[day].count += 1;
    }
    const dailyRevenue = Object.entries(dailyMap)
      .map(([date, v]) => ({ date, revenue: Math.round(v.revenue * 1e6) / 1e6, count: v.count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── Recent payments (last 50, truncated addresses) ──
    const { data: recentRows } = await supabase
      .from("x402_payments")
      .select("payer_address, endpoint, amount_usdc, tier_discount, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    const recentPayments = (recentRows || []).map((r) => ({
      payer: truncateAddress(r.payer_address),
      endpoint: r.endpoint,
      amountUsdc: Number(r.amount_usdc),
      tierDiscount: Number(r.tier_discount),
      time: r.created_at,
    }));

    // ── Buyback stats ──
    let buyback = { totalUsdcBoughtBack: 0, totalMontraBurned: 0, totalOrders: 0 };
    try {
      const { data: buybacks } = await supabase
        .from("buyback_orders")
        .select("usdc_amount, montra_burned, status")
        .in("status", ["filled", "burned"]);

      if (buybacks && buybacks.length > 0) {
        buyback = {
          totalUsdcBoughtBack: buybacks.reduce((s, r) => s + Number(r.usdc_amount), 0),
          totalMontraBurned: buybacks.reduce((s, r) => s + Number(r.montra_burned || 0), 0),
          totalOrders: buybacks.length,
        };
      }
    } catch {
      // buyback_orders table may not exist yet — that's fine
    }

    // Cache for 30 seconds
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=30");

    return res.status(200).json({
      totalRevenue: Math.round(totalRevenue * 1e6) / 1e6,
      revenue24h: Math.round(revenue24h * 1e6) / 1e6,
      revenue7d: Math.round(revenue7d * 1e6) / 1e6,
      revenue30d: Math.round(revenue30d * 1e6) / 1e6,
      totalPayments,
      avgPayment: Math.round(avgPayment * 1e6) / 1e6,
      uniquePayers,
      byEndpoint,
      dailyRevenue,
      recentPayments,
      buyback,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
