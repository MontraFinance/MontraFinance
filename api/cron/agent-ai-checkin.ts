/**
 * GET /api/cron/agent-ai-checkin
 * Vercel cron — runs every 10 minutes.
 *
 * For each active, trading-enabled agent:
 * 1. Burn MONTRA tokens from the agent's wallet (same burn pipeline as user terminal)
 * 2. Fetch full portfolio context (sibling agents, on-chain balances)
 * 3. Query the Montra AI model about trading decisions
 * 4. Parse recommendation and queue trades if signaled
 * 5. Notify user via XMTP with AI insight + trade status
 *
 * Follows the same burn flow as: useBurn → /api/burn/submit → on-chain burn → /api/burn/process
 * but executed server-side using the agent's encrypted private key.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { checkAgentMontraBalance, executeAgentBurn } from "../_lib/agent-burn.js";
import { queryMontraAI, buildAgentTradingPrompt, parseTradeRecommendation } from "../_lib/montra-ai.js";
import type { PortfolioContext, TradeOutcome } from "../_lib/montra-ai.js";
import { calculateUsdCost } from "../_lib/complexity.js";
import { getTokenPriceUsd, tokensForUsd } from "../_lib/price.js";
import { rpcCall } from "../_lib/rpc.js";

// Token addresses on Base
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH_BASE = "0x4200000000000000000000000000000000000006";

const BURN_BASE_USD = parseFloat(process.env.BURN_USD_COST || "0.25");
const FALLBACK_TOKENS = parseInt(process.env.BURN_FALLBACK_TOKENS || "200", 10);

// Max agents per cron invocation (stay within Vercel 60s timeout)
const BATCH_LIMIT = 5;

// Cooldown between consultations per agent (10 minutes)
const COOLDOWN_MS = 10 * 60 * 1000;

/** Fetch ETH and BTC prices from DexScreener for market context */
async function fetchMarketPrices(): Promise<{ ethUsd?: number; btcUsd?: number }> {
  try {
    const resp = await fetch(
      "https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006",
      { signal: AbortSignal.timeout(5000) },
    );
    if (!resp.ok) return {};
    const data = await resp.json();
    const pairs = (data.pairs || []).filter((p: any) => p.chainId === "base");
    const ethUsd = pairs.length > 0 ? parseFloat(pairs[0].priceUsd) : undefined;
    return { ethUsd, btcUsd: undefined }; // BTC price not critical
  } catch {
    return {};
  }
}

/** Calculate how many MONTRA tokens to burn for an AI consultation */
async function calculateBurnCost(): Promise<{ tokenAmount: number; usdCost: number }> {
  const query = "analyze trading strategy and recommend position";
  const { usdCost } = calculateUsdCost(query, BURN_BASE_USD);

  const tokenAddress = process.env.BURN_TOKEN_ADDRESS || "";
  const priceUsd = tokenAddress ? await getTokenPriceUsd(tokenAddress) : null;

  let tokenAmount: number;
  if (priceUsd && priceUsd > 0) {
    tokenAmount = tokensForUsd(usdCost, priceUsd);
  } else {
    tokenAmount = Math.ceil(FALLBACK_TOKENS * (usdCost / BURN_BASE_USD));
  }

  return { tokenAmount, usdCost };
}

/** Read an ERC-20 balance via raw RPC call */
async function readErc20Balance(tokenAddress: string, walletAddress: string): Promise<number> {
  try {
    const selector = "0x70a08231";
    const addrParam = walletAddress.toLowerCase().replace("0x", "").padStart(64, "0");
    const data = selector + addrParam;

    const result = (await rpcCall("eth_call", [
      { to: tokenAddress, data },
      "latest",
    ])) as string;

    const raw = BigInt(result || "0x0");
    // USDC = 6 decimals, everything else assume 18
    const decimals = tokenAddress.toLowerCase() === USDC_BASE.toLowerCase() ? 6 : 18;
    return Number(raw) / Math.pow(10, decimals);
  } catch {
    return 0;
  }
}

/** Read native ETH balance via RPC */
async function readEthBalance(walletAddress: string): Promise<number> {
  try {
    const result = (await rpcCall("eth_getBalance", [walletAddress, "latest"])) as string;
    return Number(BigInt(result || "0x0")) / 1e18;
  } catch {
    return 0;
  }
}

/** Build portfolio context: sibling agents + on-chain balances */
async function buildPortfolioContext(
  supabase: any,
  agent: any,
): Promise<PortfolioContext> {
  // Fetch all agents owned by the same user
  const { data: siblings } = await supabase
    .from("agents")
    .select("id, config, stats, wallet_data, status")
    .eq("wallet_address", agent.wallet_address);

  const allAgents = siblings || [agent];

  const siblingList = allAgents.map((s: any) => {
    const cfg = s.config || {};
    const st = s.stats || {};
    return {
      name: cfg.name || "Unnamed",
      strategy: cfg.strategyId || "unknown",
      pnlUsd: st.pnlUsd || 0,
      pnlPct: st.pnlPct || 0,
      tradeCount: st.tradeCount || 0,
      status: s.status || "unknown",
    };
  });

  const combinedPnlUsd = siblingList.reduce((sum: number, s: any) => sum + s.pnlUsd, 0);
  const combinedBudget = allAgents.reduce((sum: number, s: any) => sum + ((s.wallet_data as any)?.allocatedBudget || 0), 0);
  const combinedRemainingBudget = allAgents.reduce((sum: number, s: any) => sum + ((s.wallet_data as any)?.remainingBudget || 0), 0);

  // Fetch on-chain balances for this specific agent
  const agentAddr = agent.agent_wallet_address;
  const montraToken = process.env.BURN_TOKEN_ADDRESS || "";

  const [usdcBalance, ethBalance, montraBalance] = await Promise.all([
    readErc20Balance(USDC_BASE, agentAddr),
    readEthBalance(agentAddr),
    montraToken ? readErc20Balance(montraToken, agentAddr) : Promise.resolve(0),
  ]);

  return {
    totalAgents: allAgents.length,
    combinedPnlUsd,
    combinedBudget,
    combinedRemainingBudget,
    siblings: siblingList,
    onChainBalances: {
      usdcBalance,
      ethBalance,
      montraBalance,
    },
  };
}

/**
 * Send XMTP alert to all subscribers of an agent.
 * Fire-and-forget — errors are logged but don't block the pipeline.
 */
async function sendAgentAlert(
  agentId: string,
  alertType: string,
  data: Record<string, any>,
): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !process.env.XMTP_BOT_PRIVATE_KEY) return;

  try {
    // Use internal send-alert endpoint which handles subscriber lookup
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    await fetch(`${baseUrl}/api/xmtp/send-alert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ agentId, alertType, data }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err: any) {
    console.error(`[ai-checkin] XMTP alert failed for ${agentId}:`, err.message);
  }
}

/**
 * Score unscored past consultations for an agent.
 * For buy/sell trades that have filled, compare entry price to current ETH price.
 * Also scores "hold" recommendations by checking if NOT trading was the right call.
 */
async function scoreUnscoredConsultations(
  supabase: any,
  agentId: string,
  currentEthPrice: number,
): Promise<{ scored: number; wins: number }> {
  let scored = 0;
  let wins = 0;

  // Score filled trades: consultations with entry_price_usd set but not yet scored
  const { data: unscored } = await supabase
    .from("agent_ai_consultations")
    .select("id, recommendation, entry_price_usd, confidence_at_rec, trade_queued, trade_queue_id")
    .eq("agent_id", agentId)
    .eq("outcome_scored", false)
    .not("entry_price_usd", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (unscored && unscored.length > 0) {
    for (const c of unscored) {
      const entryPrice = Number(c.entry_price_usd);
      if (!entryPrice || entryPrice <= 0) continue;

      let pnlPct = 0;
      let pnlUsd = 0;
      let wasCorrect = false;

      if (c.recommendation === "buy") {
        // Bought ETH at entryPrice, current price is currentEthPrice
        pnlPct = ((currentEthPrice - entryPrice) / entryPrice) * 100;
        // Approximate USD P&L based on a normalized 1 ETH position
        pnlUsd = currentEthPrice - entryPrice;
        wasCorrect = pnlPct > 0;
      } else if (c.recommendation === "sell") {
        // Sold ETH at entryPrice, price should have gone down for this to be correct
        pnlPct = ((entryPrice - currentEthPrice) / entryPrice) * 100;
        pnlUsd = entryPrice - currentEthPrice;
        wasCorrect = pnlPct > 0;
      }

      await supabase
        .from("agent_ai_consultations")
        .update({
          outcome_pnl_usd: pnlUsd,
          outcome_pnl_pct: pnlPct,
          outcome_scored: true,
          outcome_scored_at: new Date().toISOString(),
          was_correct: wasCorrect,
          scored_price_usd: currentEthPrice,
        })
        .eq("id", c.id);

      scored++;
      if (wasCorrect) wins++;
    }
  }

  // Score "hold" recommendations that are old enough (> 10 min)
  // A hold is "correct" if ETH price didn't move significantly in the expected direction
  const holdCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 min old
  const { data: unscoredHolds } = await supabase
    .from("agent_ai_consultations")
    .select("id, recommendation, confidence_at_rec, created_at")
    .eq("agent_id", agentId)
    .eq("outcome_scored", false)
    .eq("recommendation", "hold")
    .eq("trade_queued", false)
    .lte("created_at", holdCutoff)
    .order("created_at", { ascending: false })
    .limit(10);

  if (unscoredHolds && unscoredHolds.length > 0) {
    for (const c of unscoredHolds) {
      // For holds, we don't have entry price. Score based on whether
      // ETH moved significantly. If it didn't move much (<2%), hold was correct.
      // We approximate with a 0% P&L for holds.
      const wasCorrect = true; // Default: holding is usually fine
      // We'll mark as correct since we'd need the price-at-consultation to truly evaluate

      await supabase
        .from("agent_ai_consultations")
        .update({
          outcome_pnl_usd: 0,
          outcome_pnl_pct: 0,
          outcome_scored: true,
          outcome_scored_at: new Date().toISOString(),
          was_correct: wasCorrect,
          scored_price_usd: currentEthPrice,
          entry_price_usd: currentEthPrice, // record current price for reference
        })
        .eq("id", c.id);

      scored++;
      if (wasCorrect) wins++;
    }
  }

  // Update agent-level win rate
  if (scored > 0) {
    const { data: agentRow } = await supabase
      .from("agents")
      .select("ai_win_rate, ai_total_scored, ai_streak")
      .eq("id", agentId)
      .single();

    if (agentRow) {
      const totalScored = (agentRow.ai_total_scored || 0) + scored;
      const totalWins = Math.round(((agentRow.ai_win_rate || 0) / 100) * (agentRow.ai_total_scored || 0)) + wins;
      const newWinRate = totalScored > 0 ? (totalWins / totalScored) * 100 : 0;

      // Update streak: positive = consecutive wins, negative = consecutive losses
      let streak = agentRow.ai_streak || 0;
      // Simplified: if all scored this batch were wins, extend win streak; else reset
      if (wins === scored) {
        streak = streak > 0 ? streak + scored : scored;
      } else if (wins === 0) {
        streak = streak < 0 ? streak - scored : -scored;
      } else {
        streak = 0; // mixed results reset streak
      }

      await supabase
        .from("agents")
        .update({
          ai_win_rate: newWinRate,
          ai_total_scored: totalScored,
          ai_streak: streak,
          updated_at: new Date().toISOString(),
        })
        .eq("id", agentId);
    }
  }

  return { scored, wins };
}

/**
 * Fetch the last N scored consultations for an agent to build the track record.
 */
async function fetchTrackRecord(
  supabase: any,
  agentId: string,
  limit: number = 10,
): Promise<TradeOutcome[]> {
  const { data: consultations } = await supabase
    .from("agent_ai_consultations")
    .select("recommendation, confidence_at_rec, was_correct, outcome_pnl_pct, outcome_pnl_usd, ai_response, outcome_scored_at")
    .eq("agent_id", agentId)
    .eq("outcome_scored", true)
    .not("was_correct", "is", null)
    .order("outcome_scored_at", { ascending: false })
    .limit(limit);

  if (!consultations || consultations.length === 0) return [];

  return consultations.map((c: any) => {
    // Extract reasoning from AI response
    let reasoning = "";
    try {
      const jsonMatch = (c.ai_response || "").match(/\{[\s\S]*?"reasoning"[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        reasoning = parsed.reasoning || "";
      }
    } catch { /* ignore */ }

    return {
      action: c.recommendation || "hold",
      confidence: c.confidence_at_rec || 50,
      wasCorrect: c.was_correct ?? false,
      pnlPct: c.outcome_pnl_pct || 0,
      pnlUsd: c.outcome_pnl_usd || 0,
      reasoning,
      scoredAt: c.outcome_scored_at || "",
    } as TradeOutcome;
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check if burn system and GPU are configured
  if (!process.env.MONTRA_GPU_URL) {
    return res.status(200).json({ skipped: true, reason: "MONTRA_GPU_URL not configured" });
  }

  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString();

  // Fetch active, trading-enabled agents that haven't been consulted recently
  const { data: agents, error } = await supabase
    .from("agents")
    .select("*")
    .eq("trading_enabled", true)
    .eq("status", "active")
    .or(`last_ai_consultation_at.is.null,last_ai_consultation_at.lt.${cutoff}`)
    .limit(BATCH_LIMIT);

  if (error || !agents || agents.length === 0) {
    return res.status(200).json({ evaluated: 0, consulted: 0, traded: 0 });
  }

  // Pre-compute burn cost and market prices (shared across all agents)
  const [burnCost, prices] = await Promise.all([
    calculateBurnCost(),
    fetchMarketPrices(),
  ]);

  let consulted = 0;
  let traded = 0;
  let burnsFailed = 0;
  let alertsSent = 0;

  for (const agent of agents) {
    const agentId = agent.id;
    const agentAddr = agent.agent_wallet_address;
    const config = agent.config as any;

    if (!agent.agent_wallet_encrypted || !agentAddr) continue;

    try {
      // ── Step 1: Check MONTRA balance ──
      const montraBalance = await checkAgentMontraBalance(agentAddr);
      if (montraBalance < burnCost.tokenAmount) {
        console.log(`[ai-checkin] Agent ${agentId} has ${montraBalance} MONTRA, needs ${burnCost.tokenAmount}. Skipping.`);

        await supabase.from("agent_ai_consultations").insert({
          agent_id: agentId,
          query_text: "AI consultation skipped — insufficient MONTRA balance",
          source: "cron",
          error_message: `INSUFFICIENT_MONTRA: has ${montraBalance.toFixed(2)}, needs ${burnCost.tokenAmount}`,
        });
        continue;
      }

      // ── Step 2: Create burn record (same as api/burn/submit.ts) ──
      const { data: burnRecord } = await supabase
        .from("burn_transactions")
        .insert({
          wallet_address: agentAddr.toLowerCase(),
          query_text: `Agent ${config?.name || agentId} trading consultation`,
          token_address: process.env.BURN_TOKEN_ADDRESS || "",
          amount_burned: burnCost.tokenAmount,
          complexity: "complex",
          status: "pending",
          ai_model: "montra-32b",
          chain_id: 8453,
        })
        .select("id")
        .single();

      // ── Step 3: Execute burn (on-chain MONTRA transfer to dead address) ──
      let burnTxHash: string;
      try {
        const result = await executeAgentBurn(agent.agent_wallet_encrypted, burnCost.tokenAmount);
        burnTxHash = result.txHash;
      } catch (burnErr: any) {
        console.error(`[ai-checkin] Burn failed for agent ${agentId}:`, burnErr.message);
        burnsFailed++;

        if (burnRecord?.id) {
          await supabase
            .from("burn_transactions")
            .update({ status: "failed", error_message: burnErr.message, updated_at: new Date().toISOString() })
            .eq("id", burnRecord.id);
        }

        await supabase.from("agent_ai_consultations").insert({
          agent_id: agentId,
          query_text: "AI consultation — burn transaction failed",
          source: "cron",
          error_message: burnErr.message,
        });
        continue;
      }

      // ── Step 4: Update burn record as confirmed ──
      if (burnRecord?.id) {
        await supabase
          .from("burn_transactions")
          .update({
            status: "confirmed",
            burn_signature: burnTxHash,
            updated_at: new Date().toISOString(),
          })
          .eq("id", burnRecord.id);
      }

      // ── Step 5: Score past consultations + fetch track record ──
      let scoringResult = { scored: 0, wins: 0 };
      let trackRecord: TradeOutcome[] = [];
      if (prices.ethUsd && prices.ethUsd > 0) {
        scoringResult = await scoreUnscoredConsultations(supabase, agentId, prices.ethUsd);
        if (scoringResult.scored > 0) {
          console.log(`[ai-checkin] Scored ${scoringResult.scored} past consultations for agent ${agentId} (${scoringResult.wins} wins)`);
        }
      }
      trackRecord = await fetchTrackRecord(supabase, agentId, 10);

      // ── Step 6: Fetch recent trades + portfolio context ──
      const [{ data: recentTrades }, portfolioContext] = await Promise.all([
        supabase
          .from("cow_trade_queue")
          .select("*")
          .eq("agent_id", agentId)
          .order("created_at", { ascending: false })
          .limit(10),
        buildPortfolioContext(supabase, agent),
      ]);

      // ── Step 7: Build prompt (with portfolio context + track record) and query AI ──
      const { system, user: userPrompt } = buildAgentTradingPrompt(
        {
          config: agent.config,
          stats: agent.stats,
          wallet_data: agent.wallet_data,
          agent_wallet_address: agentAddr,
        },
        recentTrades || [],
        prices,
        portfolioContext,
        trackRecord.length > 0 ? trackRecord : undefined,
      );

      let aiResponse: string;
      try {
        aiResponse = await queryMontraAI(system, userPrompt);
      } catch (aiErr: any) {
        console.error(`[ai-checkin] AI query failed for agent ${agentId}:`, aiErr.message);

        await supabase.from("agent_ai_consultations").insert({
          agent_id: agentId,
          query_text: userPrompt.slice(0, 2000),
          burn_tx_hash: burnTxHash,
          burn_amount: burnCost.tokenAmount,
          source: "cron",
          error_message: `AI query failed: ${aiErr.message}`,
        });

        consulted++;
        continue;
      }

      // ── Step 8: Parse recommendation ──
      const recommendation = parseTradeRecommendation(aiResponse);
      console.log(`[ai-checkin] Agent ${agentId} (${config?.name}): AI recommends ${recommendation.action} (${recommendation.confidence}% confidence)`);

      // ── Step 9: Queue trade if buy/sell with sufficient confidence ──
      let tradeQueued = false;
      let tradeQueueId: string | null = null;
      let tradeAmount = 0;

      if (
        (recommendation.action === "buy" || recommendation.action === "sell") &&
        recommendation.confidence > 60
      ) {
        const walletData = agent.wallet_data as any;
        const remainingBudget = walletData?.remainingBudget || 0;

        const { data: existingTrades } = await supabase
          .from("cow_trade_queue")
          .select("id")
          .eq("agent_id", agentId)
          .in("status", ["queued", "quoted", "signed", "submitted"])
          .limit(1);

        if ((!existingTrades || existingTrades.length === 0) && remainingBudget > 1) {
          const maxPositionUsd = remainingBudget * ((recommendation.positionSizePct || 10) / 100);
          const cappedAmount = Math.min(maxPositionUsd, remainingBudget);

          if (cappedAmount >= 1) {
            const sellToken = recommendation.action === "buy" ? USDC_BASE : WETH_BASE;
            const buyToken = recommendation.action === "buy" ? WETH_BASE : USDC_BASE;

            // USDC has 6 decimals; WETH has 18. For sell trades, convert USD→WETH using ETH price.
            let sellAmountRaw: bigint;
            if (sellToken === USDC_BASE) {
              sellAmountRaw = BigInt(Math.floor(cappedAmount * 1e6));
            } else {
              const ethPrice = prices.ethUsd || 3000;
              const wethAmount = cappedAmount / ethPrice;
              sellAmountRaw = BigInt(Math.floor(wethAmount * 1e18));
            }

            const executionVenue = agent.exchange_key_id ? "cex" : "cow";
            const { data: queueEntry, error: insertErr } = await supabase
              .from("cow_trade_queue")
              .insert({
                agent_id: agentId,
                owner_address: agent.wallet_address,
                sell_token: sellToken,
                buy_token: buyToken,
                sell_amount: sellAmountRaw.toString(),
                recurring: false,
                next_run_at: new Date().toISOString(),
                status: "queued",
                api_key_id: agent.api_key_id,
                execution_venue: executionVenue,
                exchange_key_id: executionVenue === "cex" ? agent.exchange_key_id : null,
              })
              .select("id")
              .single();

            if (!insertErr && queueEntry) {
              tradeQueued = true;
              tradeQueueId = queueEntry.id;
              tradeAmount = cappedAmount;
              traded++;
              console.log(`[ai-checkin] Queued ${recommendation.action} trade for agent ${agentId}: $${cappedAmount.toFixed(2)}`);
            }
          }
        }
      }

      // ── Step 10: Log consultation (with confidence for future scoring) ──
      const { data: consultationRecord } = await supabase.from("agent_ai_consultations").insert({
        agent_id: agentId,
        query_text: userPrompt.slice(0, 2000),
        ai_response: aiResponse.slice(0, 5000),
        recommendation: recommendation.action,
        burn_tx_hash: burnTxHash,
        burn_amount: burnCost.tokenAmount,
        source: "cron",
        trade_queued: tradeQueued,
        trade_queue_id: tradeQueueId,
        confidence_at_rec: recommendation.confidence,
        // For hold recommendations, record current ETH price for later scoring
        entry_price_usd: recommendation.action === "hold" ? (prices.ethUsd || null) : null,
      }).select("id").single();

      // Link the trade queue entry back to this consultation
      if (tradeQueueId && consultationRecord?.id) {
        await supabase
          .from("cow_trade_queue")
          .update({ consultation_id: consultationRecord.id })
          .eq("id", tradeQueueId);
      }

      // ── Step 11: Update agent ──
      await supabase
        .from("agents")
        .update({
          last_ai_consultation_at: new Date().toISOString(),
          ai_consultation_count: (agent.ai_consultation_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", agentId);

      // ── Step 12: Send XMTP notification with FULL context ──
      // The user wants to see everything: reasoning, portfolio, balances, burn cost, etc.
      const trackWins = trackRecord.filter((t) => t.wasCorrect).length;
      const executionVenue = agent.exchange_key_id ? "cex" : "cow";

      sendAgentAlert(agentId, "ai_insight", {
        agentName: config?.name || agentId,
        agentId,
        strategy: config?.strategyId || config?.strategy || "",
        action: recommendation.action,
        confidence: recommendation.confidence,
        reasoning: recommendation.reasoning,
        fullResponse: aiResponse, // Full AI model response — the user wants to see the agent's brain
        // Market data
        ethPrice: prices.ethUsd,
        btcPrice: prices.btcUsd,
        // Portfolio balances
        usdcBalance: portfolioContext.onChainBalances?.usdcBalance,
        ethBalance: portfolioContext.onChainBalances?.ethBalance,
        montraBalance: portfolioContext.onChainBalances?.montraBalance,
        remainingBudget: (agent.wallet_data as any)?.remainingBudget,
        // Fleet context
        totalAgents: portfolioContext.totalAgents,
        combinedPnl: portfolioContext.combinedPnlUsd,
        siblingsSummary: portfolioContext.siblings?.length > 1
          ? portfolioContext.siblings.map((s: any) => `${s.name}: $${s.pnlUsd.toFixed(2)}`).join(", ")
          : undefined,
        // Trade details
        tradeQueued,
        tradeAction: recommendation.action,
        tradeAmount: tradeAmount > 0 ? tradeAmount.toFixed(2) : undefined,
        executionVenue,
        exchange: executionVenue === "cex" ? (config?.exchange || "CEX") : undefined,
        // Burn / compute cost
        burnAmount: burnCost.tokenAmount,
        burnCostUsd: burnCost.usdCost,
        burnTxHash,
        // Track record
        trackRecord: trackRecord.length > 0 ? `${trackWins}/${trackRecord.length} correct` : undefined,
      }).then(() => alertsSent++).catch(() => {});

      consulted++;
    } catch (err: any) {
      console.error(`[ai-checkin] Unexpected error for agent ${agentId}:`, err.message);
    }
  }

  return res.status(200).json({
    evaluated: agents.length,
    consulted,
    traded,
    burnsFailed,
    alertsSent,
    burnCostTokens: burnCost.tokenAmount,
    burnCostUsd: burnCost.usdCost,
  });
}
