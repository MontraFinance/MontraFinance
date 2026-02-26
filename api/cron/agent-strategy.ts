/**
 * GET /api/cron/agent-strategy
 * Vercel cron — runs every 5 minutes.
 * Evaluates trading strategies for active agents and inserts trades
 * into the cow_trade_queue when signals trigger.
 *
 * Starting with DCA strategy: periodic buys at fixed intervals.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";

// Token addresses on Base
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH_BASE = "0x4200000000000000000000000000000000000006";
const CBBTC_BASE = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";

// Strategy-specific trade parameters
interface TradeSignal {
  sellToken: string;
  buyToken: string;
  sellAmountUsd: number;
}

/** DCA strategy: periodic buys */
function evaluateDca(config: any, walletData: any): TradeSignal | null {
  const remainingBudget = walletData?.remainingBudget || 0;
  if (remainingBudget <= 0) return null;

  // DCA: buy WETH with a fixed percentage of remaining budget each cycle
  const positionPct = Math.min(config.maxPositionSizePct || 25, 10); // cap at 10% per DCA cycle
  const tradeAmount = Math.min(
    remainingBudget * (positionPct / 100),
    remainingBudget,
  );

  if (tradeAmount < 1) return null; // min $1 trade

  return {
    sellToken: USDC_BASE,
    buyToken: WETH_BASE,
    sellAmountUsd: tradeAmount,
  };
}

/** Momentum strategy: buy on positive trend */
function evaluateMomentum(config: any, walletData: any, stats: any): TradeSignal | null {
  const remainingBudget = walletData?.remainingBudget || 0;
  if (remainingBudget <= 0) return null;

  // Simplified: trade if P&L trend is positive or if it's the first trade
  const tradeCount = stats?.tradeCount || 0;
  const pnlPct = stats?.pnlPct || 0;

  if (tradeCount > 0 && pnlPct < -5) return null; // skip if losing

  const positionPct = config.maxPositionSizePct || 25;
  const tradeAmount = Math.min(
    remainingBudget * (positionPct / 100),
    remainingBudget,
  );

  if (tradeAmount < 1) return null;

  return {
    sellToken: USDC_BASE,
    buyToken: WETH_BASE,
    sellAmountUsd: tradeAmount,
  };
}

/** Evaluate strategy and return trade signal if conditions are met */
function evaluateStrategy(
  strategyId: string,
  config: any,
  walletData: any,
  stats: any,
): TradeSignal | null {
  switch (strategyId) {
    case "dca":
      return evaluateDca(config, walletData);
    case "momentum":
    case "breakout":
      return evaluateMomentum(config, walletData, stats);
    case "mean_reversion":
    case "grid_trading":
    case "arbitrage":
      // These strategies use the same DCA-like entry for now
      return evaluateDca(config, walletData);
    default:
      return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = getSupabase();

  // Fetch all active, trading-enabled agents
  const { data: agents, error } = await supabase
    .from("agents")
    .select("*")
    .eq("trading_enabled", true)
    .eq("status", "active");

  if (error || !agents || agents.length === 0) {
    return res.status(200).json({ evaluated: 0, queued: 0 });
  }

  let queued = 0;
  let paused = 0;

  for (const agent of agents) {
    const config = agent.config as any;
    const walletData = agent.wallet_data as any;
    const stats = agent.stats as any;

    // Check drawdown before trading
    const maxDrawdown = config?.maxDrawdownPct || 15;
    if (stats && Math.abs(stats.pnlPct || 0) > maxDrawdown) {
      console.log(`[agent-strategy] Agent ${agent.id} exceeds max drawdown, auto-pausing`);
      await supabase
        .from("agents")
        .update({ status: "paused", trading_enabled: false, updated_at: new Date().toISOString() })
        .eq("id", agent.id);
      paused++;
      continue;
    }

    // Check if agent already has a pending/queued trade
    const { data: existingTrades } = await supabase
      .from("cow_trade_queue")
      .select("id")
      .eq("agent_id", agent.id)
      .in("status", ["queued", "quoted", "signed", "submitted"])
      .limit(1);

    if (existingTrades && existingTrades.length > 0) {
      continue; // Already has an active trade, skip
    }

    // Evaluate strategy
    const signal = evaluateStrategy(
      config?.strategyId || "dca",
      config,
      walletData,
      stats,
    );

    if (!signal) continue;

    // Cap position size by maxPositionSizePct * remainingBudget
    const maxPositionUsd = (walletData?.remainingBudget || 0) * ((config?.maxPositionSizePct || 25) / 100);
    const cappedAmount = Math.min(signal.sellAmountUsd, maxPositionUsd);
    if (cappedAmount < 1) continue;

    // Convert USD amount to USDC raw amount (6 decimals)
    const sellAmountRaw = BigInt(Math.floor(cappedAmount * 1e6));

    // Insert trade into queue
    const { error: insertErr } = await supabase
      .from("cow_trade_queue")
      .insert({
        agent_id: agent.id,
        owner_address: agent.wallet_address,
        sell_token: signal.sellToken,
        buy_token: signal.buyToken,
        sell_amount: sellAmountRaw.toString(),
        recurring: false,
        next_run_at: new Date().toISOString(),
        status: "queued",
        api_key_id: agent.api_key_id,
      });

    if (insertErr) {
      console.error(`[agent-strategy] Insert failed for agent ${agent.id}:`, insertErr.message);
      continue;
    }

    queued++;
    console.log(`[agent-strategy] Queued ${config?.strategyId} trade for agent ${agent.id}: $${cappedAmount.toFixed(2)} USDC -> WETH`);
  }

  return res.status(200).json({
    evaluated: agents.length,
    queued,
    paused,
  });
}
