/**
 * GET /api/cron/sentiment-trader
 * Vercel cron — runs every 5 minutes.
 *
 * When Farcaster community sentiment about $MONTRA crosses a bullish threshold,
 * auto-buys USDC worth of MONTRA via CoW Protocol (MEV-protected) and posts
 * the trade to Farcaster for full transparency.
 *
 * Env vars required:
 *   SENTIMENT_TRADER_ENABLED=true
 *   SENTIMENT_THRESHOLD=0.5        (minimum avg_score to trigger, default 0.5)
 *   SENTIMENT_TRADE_USDC=50        (USDC per trade, default 50)
 *   SENTIMENT_COOLDOWN_HOURS=4     (hours between trades, default 4)
 *   BUYBACK_PRIVATE_KEY=0x...      (same key as buyback-executor)
 *   X402_RECEIVING_WALLET=0x...    (same wallet as buyback-executor)
 *   BURN_TOKEN_ADDRESS=0x...       (MONTRA token address)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { getCowQuote, submitCowOrder } from "../_lib/cow.js";
import { castSentimentTrade } from "../_lib/cast-templates.js";
import {
  getUsdcBalance,
  getUsdcAllowance,
  approveUsdcForCow,
  signCowOrder,
  USDC_ADDRESS,
} from "../_lib/wallet.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Auth
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Feature flag
  if (process.env.SENTIMENT_TRADER_ENABLED !== "true") {
    return res.status(200).json({ skipped: true, reason: "SENTIMENT_TRADER_ENABLED is not true" });
  }

  // Config
  const THRESHOLD = parseFloat(process.env.SENTIMENT_THRESHOLD || "0.5");
  const TRADE_USDC = parseFloat(process.env.SENTIMENT_TRADE_USDC || "50");
  const COOLDOWN_HOURS = parseFloat(process.env.SENTIMENT_COOLDOWN_HOURS || "4");
  const PRIVATE_KEY = process.env.BUYBACK_PRIVATE_KEY;
  const WALLET = process.env.X402_RECEIVING_WALLET || "0x9B767bD2895DE4154195124EF091445F6daa8337";
  const MONTRA_ADDRESS = process.env.BURN_TOKEN_ADDRESS;

  if (!PRIVATE_KEY) {
    return res.status(200).json({ skipped: true, reason: "BUYBACK_PRIVATE_KEY not configured" });
  }
  if (!MONTRA_ADDRESS) {
    return res.status(200).json({ skipped: true, reason: "BURN_TOKEN_ADDRESS not configured" });
  }

  const supabase = getSupabase();

  try {
    // 1. Get latest sentiment snapshot
    const { data: snapshot, error: snapError } = await supabase
      .from("sentiment_snapshots")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (snapError || !snapshot) {
      return res.status(200).json({ skipped: true, reason: "No sentiment snapshot available" });
    }

    const avgScore = Number(snapshot.avg_score);

    // 2. Check threshold
    if (avgScore < THRESHOLD) {
      return res.status(200).json({
        skipped: true,
        reason: "Sentiment below threshold",
        avg_score: avgScore,
        threshold: THRESHOLD,
      });
    }

    // 3. Check cooldown — no trade in the last N hours
    const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60_000).toISOString();
    const { data: recentTrades } = await supabase
      .from("sentiment_trades")
      .select("id")
      .in("status", ["pending", "open", "filled"])
      .gte("created_at", cooldownCutoff)
      .limit(1);

    if (recentTrades && recentTrades.length > 0) {
      return res.status(200).json({
        skipped: true,
        reason: "Cooldown active",
        avg_score: avgScore,
        cooldown_hours: COOLDOWN_HOURS,
      });
    }

    // 4. Check USDC balance
    const balance = await getUsdcBalance(WALLET);
    if (balance < TRADE_USDC) {
      return res.status(200).json({
        skipped: true,
        reason: "Insufficient USDC balance",
        balance: Math.round(balance * 100) / 100,
        required: TRADE_USDC,
      });
    }

    // 5. Check/auto-approve USDC for CoW VaultRelayer
    const sellAmountRaw = String(Math.floor(TRADE_USDC * 1e6));
    const currentAllowance = await getUsdcAllowance(WALLET);

    let approvalTx: string | null = null;
    if (currentAllowance < BigInt(sellAmountRaw)) {
      approvalTx = await approveUsdcForCow(PRIVATE_KEY);
      console.log(`[sentiment-trader] Auto-approved USDC for CoW VaultRelayer: ${approvalTx}`);
    }

    // 6. Get CoW quote
    const quote = await getCowQuote(
      USDC_ADDRESS,
      MONTRA_ADDRESS,
      sellAmountRaw,
      WALLET,
      100, // 1% slippage for automated execution
    );

    // 7. Build and sign the order
    const order = {
      sellToken: quote.quote.sellToken,
      buyToken: quote.quote.buyToken,
      sellAmount: quote.quote.sellAmount,
      buyAmount: quote.quote.buyAmount,
      feeAmount: quote.quote.feeAmount,
      validTo: quote.quote.validTo,
      kind: quote.quote.kind,
      receiver: WALLET,
      from: WALLET,
      appData: "0x0000000000000000000000000000000000000000000000000000000000000000",
      partiallyFillable: false,
      sellTokenBalance: "erc20",
      buyTokenBalance: "erc20",
    };

    const signature = await signCowOrder(order, PRIVATE_KEY);

    // 8. Submit to CoW
    const result = await submitCowOrder(order, signature, "eip712");

    // 9. Log to sentiment_trades
    await supabase.from("sentiment_trades").insert({
      order_uid: result.uid,
      sentiment_score: avgScore,
      usdc_amount: TRADE_USDC,
      status: "pending",
      trigger_snapshot_id: snapshot.id,
      cow_quote_data: quote,
    });

    // 10. Queue Farcaster announcement (farcaster-post cron will publish it)
    const eventKey = `sentiment_trade:${result.uid}`;
    await supabase.from("farcaster_casts").insert({
      event_type: "sentiment_trade",
      event_key: eventKey,
      cast_text: castSentimentTrade(avgScore, TRADE_USDC),
      status: "pending",
    });

    return res.status(200).json({
      executed: true,
      orderUid: result.uid,
      sentimentScore: avgScore,
      usdcAmount: TRADE_USDC,
      expectedMontra: quote.quote.buyAmount,
      ...(approvalTx ? { approvalTx } : {}),
    });
  } catch (err: any) {
    // Log failure to DB
    try {
      await supabase.from("sentiment_trades").insert({
        sentiment_score: 0,
        usdc_amount: 0,
        status: "failed",
        error_message: err.message?.slice(0, 500),
      });
    } catch {
      // Ignore logging failure
    }

    return res.status(500).json({ error: err.message });
  }
}
