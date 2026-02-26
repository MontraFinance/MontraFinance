/**
 * GET /api/cron/agent-trader
 * Vercel cron — runs every 2 minutes.
 * For agents with trading_enabled=true: decrypts agent key, gets CoW quotes,
 * signs orders, and submits them. Updates trade queue status through the
 * lifecycle: queued -> quoted -> signed -> submitted -> filled.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { getCowQuote, submitCowOrder, getCowOrderStatus } from "../_lib/cow.js";
import { decryptAgentKey, decryptData } from "../_lib/agent-wallet.js";
import { placeCexMarketOrder, getCexOrderStatus as getCexStatus } from "../_lib/cex-execution.js";
import { resolveExchangeSymbol, formatQuantity } from "../_lib/cex-symbols.js";
import { ethers } from "ethers";
import { rpcCall } from "../_lib/rpc.js";

// CoW Protocol EIP-712 domain for Base
const COW_DOMAIN = {
  name: "Gnosis Protocol",
  version: "v2",
  chainId: 8453,
  verifyingContract: "0x9008D19f58AAbD9eD0D60971565AA8510560ab41",
};

const COW_ORDER_TYPES = {
  Order: [
    { name: "sellToken", type: "address" },
    { name: "buyToken", type: "address" },
    { name: "receiver", type: "address" },
    { name: "sellAmount", type: "uint256" },
    { name: "buyAmount", type: "uint256" },
    { name: "validTo", type: "uint32" },
    { name: "appData", type: "bytes32" },
    { name: "feeAmount", type: "uint256" },
    { name: "kind", type: "string" },
    { name: "partiallyFillable", type: "bool" },
    { name: "sellTokenBalance", type: "string" },
    { name: "buyTokenBalance", type: "string" },
  ],
};

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const COW_VAULT_RELAYER = "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110";

/** Sign EIP-712 typed data with ethers.js _signTypedData (secp256k1 ECDSA) */
async function signEip712Order(privateKeyHex: string, order: Record<string, any>): Promise<string> {
  const wallet = new ethers.Wallet(privateKeyHex);

  // Build the order struct matching CoW Protocol's GPv2Order
  const orderStruct = {
    sellToken: order.sellToken,
    buyToken: order.buyToken,
    receiver: order.receiver || wallet.address,
    sellAmount: order.sellAmount,
    buyAmount: order.buyAmount,
    validTo: order.validTo,
    appData: order.appData || "0x0000000000000000000000000000000000000000000000000000000000000000",
    feeAmount: order.feeAmount || "0",
    kind: order.kind || "sell",
    partiallyFillable: order.partiallyFillable || false,
    sellTokenBalance: order.sellTokenBalance || "erc20",
    buyTokenBalance: order.buyTokenBalance || "erc20",
  };

  const signature = await wallet._signTypedData(COW_DOMAIN, COW_ORDER_TYPES, orderStruct);
  return signature;
}

/**
 * Check ERC-20 allowance for agent → CoW VaultRelayer.
 * If insufficient, send an approval tx from the agent wallet.
 */
async function ensureAllowance(
  privateKeyHex: string,
  agentAddress: string,
  sellToken: string,
  requiredAmount: string,
): Promise<void> {
  // Only need approval for ERC-20 tokens (not native ETH)
  const encodeAllowance = (owner: string, spender: string) => {
    const sel = "0xdd62ed3e";
    const o = owner.toLowerCase().replace("0x", "").padStart(64, "0");
    const s = spender.toLowerCase().replace("0x", "").padStart(64, "0");
    return sel + o + s;
  };

  const allowanceHex = (await rpcCall("eth_call", [
    { to: sellToken, data: encodeAllowance(agentAddress, COW_VAULT_RELAYER) },
    "latest",
  ])) as string;

  const allowance = BigInt(allowanceHex || "0x0");
  const needed = BigInt(requiredAmount);

  if (allowance >= needed) return; // already approved enough

  console.log(`[agent-trader] Allowance insufficient (${allowance} < ${needed}), sending approval tx`);

  // Send unlimited approval using ethers.js
  const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, { name: "base", chainId: 8453 });
  const wallet = new ethers.Wallet(privateKeyHex, provider);
  const erc20 = new ethers.Contract(sellToken, [
    "function approve(address spender, uint256 amount) returns (bool)",
  ], wallet);

  const tx = await erc20.approve(COW_VAULT_RELAYER, ethers.constants.MaxUint256, { gasLimit: 60000 });
  const receipt = await tx.wait(1);
  console.log(`[agent-trader] Approval tx confirmed: ${receipt.transactionHash}`);
}

/**
 * Send XMTP alert to agent subscribers. Fire-and-forget.
 */
async function sendTradeAlert(agentId: string, data: Record<string, any>): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !process.env.XMTP_BOT_PRIVATE_KEY) return;

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    await fetch(`${baseUrl}/api/xmtp/send-alert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ agentId, alertType: "trade_filled", data }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err: any) {
    console.error(`[agent-trader] XMTP alert failed for ${agentId}:`, err.message);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = getSupabase();
  let quoted = 0;
  let signed = 0;
  let submitted = 0;
  let filled = 0;
  let cexSubmitted = 0;
  let cexFilled = 0;

  // ── Phase 1: Quote queued trades (CoW) + Execute queued trades (CEX) ──
  const { data: queued } = await supabase
    .from("cow_trade_queue")
    .select("*")
    .eq("status", "queued")
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(20);

  if (queued && queued.length > 0) {
    for (const item of queued) {
      const { data: agent } = await supabase
        .from("agents")
        .select("id, config, wallet_address, agent_wallet_address, trading_enabled, exchange_key_id")
        .eq("id", item.agent_id)
        .single();

      if (!agent || !agent.trading_enabled) continue;

      // Determine execution venue: CEX if agent has exchange_key_id, otherwise CoW
      const exchangeKeyId = item.exchange_key_id || agent.exchange_key_id;

      if (exchangeKeyId) {
        // ── CEX PATH: Decrypt keys → place market order → submitted ──
        try {
          const { data: keyRow } = await supabase
            .from("exchange_api_keys")
            .select("exchange, encrypted_data")
            .eq("id", exchangeKeyId)
            .eq("status", "active")
            .single();

          if (!keyRow) {
            console.error(`[agent-trader] Exchange key ${exchangeKeyId} not found or revoked`);
            await supabase.from("cow_trade_queue").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", item.id);
            continue;
          }

          const creds = JSON.parse(decryptData(keyRow.encrypted_data));
          const { symbol, side } = resolveExchangeSymbol(keyRow.exchange, item.sell_token, item.buy_token);
          const quantity = formatQuantity(item.sell_amount, item.sell_token);

          console.log(`[agent-trader] CEX ${keyRow.exchange}: ${side} ${symbol} qty=${quantity}`);

          const orderResult = await placeCexMarketOrder(keyRow.exchange, creds, symbol, side, quantity);

          await supabase
            .from("cow_trade_queue")
            .update({
              status: "submitted",
              exchange_key_id: exchangeKeyId,
              exchange: keyRow.exchange,
              exchange_order_id: orderResult.orderId,
              exchange_symbol: symbol,
              execution_venue: "cex",
              quote_data: {
                sellToken: item.sell_token,
                buyToken: item.buy_token,
                sellAmount: item.sell_amount,
                side,
                exchange: keyRow.exchange,
                orderId: orderResult.orderId,
                filledQty: orderResult.filledQty,
                avgPrice: orderResult.avgPrice,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          // If market order filled immediately (common for market orders)
          if (orderResult.status === "filled") {
            await supabase.from("cow_trade_queue").update({ status: "filled", updated_at: new Date().toISOString() }).eq("id", item.id);
            cexFilled++;
          } else {
            cexSubmitted++;
          }
        } catch (err: any) {
          console.error(`[agent-trader] CEX order failed for queue ${item.id}:`, err.message);
          await supabase.from("cow_trade_queue").update({
            next_run_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", item.id);
        }
      } else {
        // ── COW PATH: Get quote (existing logic) ──
        const walletAddress = agent.agent_wallet_address || agent.wallet_address;

        try {
          const quote = await getCowQuote(
            item.sell_token,
            item.buy_token,
            String(item.sell_amount),
            walletAddress,
          );

          await supabase
            .from("cow_trade_queue")
            .update({
              status: "quoted",
              quote_buy_amount: quote.quote.buyAmount,
              quote_fee_amount: quote.quote.feeAmount,
              quote_valid_to: quote.quote.validTo,
              quote_data: {
                sellToken: quote.quote.sellToken,
                buyToken: quote.quote.buyToken,
                sellAmount: quote.quote.sellAmount,
                buyAmount: quote.quote.buyAmount,
                feeAmount: "0",
                validTo: quote.quote.validTo,
                kind: quote.quote.kind,
                receiver: walletAddress,
                partiallyFillable: false,
                from: walletAddress,
                sellTokenBalance: "erc20",
                buyTokenBalance: "erc20",
              },
              execution_venue: "cow",
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          quoted++;
        } catch (err: any) {
          console.error(`Quote failed for queue ${item.id}:`, err.message);
          await supabase
            .from("cow_trade_queue")
            .update({
              next_run_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
        }
      }
    }
  }

  // ── Phase 2: Sign quoted trades with agent keys ──
  const { data: quotedTrades } = await supabase
    .from("cow_trade_queue")
    .select("*")
    .eq("status", "quoted")
    .limit(20);

  if (quotedTrades && quotedTrades.length > 0) {
    for (const item of quotedTrades) {
      const { data: agent } = await supabase
        .from("agents")
        .select("id, agent_wallet_encrypted, trading_enabled, config, wallet_data")
        .eq("id", item.agent_id)
        .single();

      if (!agent || !agent.trading_enabled || !agent.agent_wallet_encrypted) continue;

      // Enforce drawdown check before signing
      const walletData = agent.wallet_data as any;
      const stats = (await supabase.from("agents").select("stats").eq("id", agent.id).single()).data?.stats as any;
      const maxDrawdown = agent.config?.maxDrawdownPct || 15;
      if (stats && Math.abs(stats.pnlPct || 0) > maxDrawdown) {
        console.log(`[agent-trader] Agent ${agent.id} exceeds max drawdown (${stats.pnlPct}% > ${maxDrawdown}%), auto-pausing`);
        await supabase.from("agents").update({ status: "paused", trading_enabled: false, updated_at: new Date().toISOString() }).eq("id", agent.id);
        await supabase.from("cow_trade_queue").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", item.id);
        continue;
      }

      try {
        const privateKey = decryptAgentKey(agent.agent_wallet_encrypted);
        const quoteData = item.quote_data as any;
        const agentAddr = quoteData.from || quoteData.receiver;

        // Ensure the CoW VaultRelayer has approval to spend agent's sell token
        await ensureAllowance(privateKey, agentAddr, quoteData.sellToken, quoteData.sellAmount);

        // Sign the order with proper EIP-712 + secp256k1
        const signature = await signEip712Order(privateKey, quoteData);

        await supabase
          .from("cow_trade_queue")
          .update({
            status: "signed",
            quote_data: { ...quoteData, signature },
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        signed++;
      } catch (err: any) {
        console.error(`Sign failed for queue ${item.id}:`, err.message);
        // If gas error, don't retry immediately
        if (err.message?.includes("INSUFFICIENT")) {
          await supabase.from("cow_trade_queue").update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          }).eq("id", item.id);
        }
      }
    }
  }

  // ── Phase 3: Submit signed trades to CoW API ──
  const { data: signedTrades } = await supabase
    .from("cow_trade_queue")
    .select("*")
    .eq("status", "signed")
    .limit(20);

  if (signedTrades && signedTrades.length > 0) {
    for (const item of signedTrades) {
      const quoteData = item.quote_data as any;
      if (!quoteData?.signature) continue;

      try {
        const result = await submitCowOrder(quoteData, quoteData.signature, "eip712");

        await supabase
          .from("cow_trade_queue")
          .update({
            status: "submitted",
            quote_data: { ...quoteData, orderUid: result.uid },
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        submitted++;
      } catch (err: any) {
        console.error(`Submit failed for queue ${item.id}:`, err.message);
        // Mark as cancelled if submission fails (order may have expired)
        await supabase
          .from("cow_trade_queue")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", item.id);
      }
    }
  }

  // ── Phase 4: Check submitted trades for fill status (CoW + CEX) ──
  const { data: submittedTrades } = await supabase
    .from("cow_trade_queue")
    .select("*")
    .eq("status", "submitted")
    .limit(20);

  if (submittedTrades && submittedTrades.length > 0) {
    for (const item of submittedTrades) {
      const quoteData = item.quote_data as any;

      // ── CEX fill check ──
      if (item.execution_venue === "cex" && item.exchange_order_id) {
        try {
          const { data: keyRow } = await supabase
            .from("exchange_api_keys")
            .select("exchange, encrypted_data")
            .eq("id", item.exchange_key_id)
            .single();

          if (!keyRow) continue;

          const creds = JSON.parse(decryptData(keyRow.encrypted_data));
          const cexStatus = await getCexStatus(keyRow.exchange, creds, item.exchange_order_id, item.exchange_symbol || "");

          if (cexStatus.status === "filled") {
            await supabase
              .from("cow_trade_queue")
              .update({
                status: "filled",
                quote_data: { ...quoteData, filledQty: cexStatus.filledQty, avgPrice: cexStatus.avgPrice },
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.id);

            // Calculate entry price from CEX fill
            let entryPriceUsd: number | null = null;
            if (cexStatus.avgPrice) {
              entryPriceUsd = parseFloat(cexStatus.avgPrice);
            }

            // Link entry price to consultation (same as CoW path)
            if (entryPriceUsd !== null) {
              const { data: consultation } = await supabase
                .from("agent_ai_consultations")
                .select("id, recommendation, ai_response")
                .eq("trade_queue_id", item.id)
                .single();

              if (consultation) {
                let confidence = 50;
                try {
                  const jsonMatch = (consultation.ai_response || "").match(/\{[\s\S]*?"confidence"[\s\S]*?\}/);
                  if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (typeof parsed.confidence === "number") confidence = parsed.confidence;
                  }
                } catch { /* ignore */ }

                await supabase.from("agent_ai_consultations").update({
                  entry_price_usd: entryPriceUsd,
                  confidence_at_rec: confidence,
                }).eq("id", consultation.id);
              }
            }

            // Update agent stats
            const { data: agent } = await supabase.from("agents").select("stats, config").eq("id", item.agent_id).single();
            if (agent) {
              const agentStats = (agent.stats || {}) as any;
              agentStats.tradeCount = (agentStats.tradeCount || 0) + 1;
              agentStats.lastTradeAt = new Date().toISOString();
              await supabase.from("agents").update({ stats: agentStats, updated_at: new Date().toISOString() }).eq("id", item.agent_id);

              const agentConfig = (agent.config || {}) as any;
              sendTradeAlert(item.agent_id, {
                agentName: agentConfig.name || item.agent_id,
                agentId: item.agent_id,
                side: quoteData.side || "buy",
                venue: `CEX (${item.exchange})`,
                symbol: item.exchange_symbol,
                filledQty: cexStatus.filledQty,
                avgPrice: cexStatus.avgPrice,
                entryPrice: entryPriceUsd ? `$${entryPriceUsd.toFixed(2)}` : undefined,
              }).catch(() => {});
            }

            cexFilled++;
          } else if (cexStatus.status === "cancelled" || cexStatus.status === "rejected") {
            await supabase.from("cow_trade_queue").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", item.id);
          }
        } catch (err: any) {
          console.error(`[agent-trader] CEX status check failed for ${item.exchange_order_id}:`, err.message);
        }
        continue; // Skip CoW check for CEX trades
      }

      // ── CoW fill check (existing logic) ──
      const orderUid = quoteData?.orderUid;
      if (!orderUid) continue;

      try {
        const status = await getCowOrderStatus(orderUid);

        if (status.status === "fulfilled" || status.status === "traded") {
          await supabase
            .from("cow_trade_queue")
            .update({
              status: "filled",
              quote_data: { ...quoteData, executedBuyAmount: status.executedBuyAmount, executedSellAmount: status.executedSellAmount },
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          // ── Calculate entry price for outcome scoring ──
          const sellTokenLabel = quoteData.sellToken?.toLowerCase() === USDC_BASE.toLowerCase() ? "USDC" : "WETH";
          const buyTokenLabel = quoteData.buyToken?.toLowerCase() === USDC_BASE.toLowerCase() ? "USDC" : "WETH";
          let entryPriceUsd: number | null = null;

          if (status.executedSellAmount && status.executedBuyAmount) {
            if (sellTokenLabel === "USDC") {
              // Bought WETH with USDC: entry price = USDC spent / WETH received
              const usdcSpent = Number(status.executedSellAmount) / 1e6;
              const wethReceived = Number(status.executedBuyAmount) / 1e18;
              if (wethReceived > 0) entryPriceUsd = usdcSpent / wethReceived;
            } else {
              // Sold WETH for USDC: entry price = USDC received / WETH sold
              const wethSold = Number(status.executedSellAmount) / 1e18;
              const usdcReceived = Number(status.executedBuyAmount) / 1e6;
              if (wethSold > 0) entryPriceUsd = usdcReceived / wethSold;
            }
          }

          // ── Link entry price back to the AI consultation that triggered this trade ──
          if (entryPriceUsd !== null) {
            // Look up the consultation that queued this trade
            const { data: consultation } = await supabase
              .from("agent_ai_consultations")
              .select("id, recommendation, ai_response")
              .eq("trade_queue_id", item.id)
              .single();

            if (consultation) {
              // Extract original confidence from the AI response
              let confidence = 50;
              try {
                const jsonMatch = (consultation.ai_response || "").match(/\{[\s\S]*?"confidence"[\s\S]*?\}/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
                  if (typeof parsed.confidence === "number") confidence = parsed.confidence;
                }
              } catch { /* ignore parse errors */ }

              await supabase
                .from("agent_ai_consultations")
                .update({
                  entry_price_usd: entryPriceUsd,
                  confidence_at_rec: confidence,
                })
                .eq("id", consultation.id);

              console.log(`[agent-trader] Recorded entry price $${entryPriceUsd.toFixed(2)} for consultation ${consultation.id}`);
            }
          }

          // Update agent stats
          const { data: agent } = await supabase
            .from("agents")
            .select("stats, wallet_data, config")
            .eq("id", item.agent_id)
            .single();

          if (agent) {
            const agentStats = (agent.stats || {}) as any;
            agentStats.tradeCount = (agentStats.tradeCount || 0) + 1;
            agentStats.lastTradeAt = new Date().toISOString();

            await supabase
              .from("agents")
              .update({ stats: agentStats, updated_at: new Date().toISOString() })
              .eq("id", item.agent_id);

            // ── Send XMTP alert on trade fill ──
            const agentConfig = (agent.config || {}) as any;
            const executedSell = status.executedSellAmount
              ? (sellTokenLabel === "USDC" ? (Number(status.executedSellAmount) / 1e6).toFixed(2) : (Number(status.executedSellAmount) / 1e18).toFixed(6))
              : "?";
            const executedBuy = status.executedBuyAmount
              ? (buyTokenLabel === "USDC" ? (Number(status.executedBuyAmount) / 1e6).toFixed(2) : (Number(status.executedBuyAmount) / 1e18).toFixed(6))
              : "?";

            sendTradeAlert(item.agent_id, {
              agentName: agentConfig.name || item.agent_id,
              agentId: item.agent_id,
              side: sellTokenLabel === "USDC" ? "buy" : "sell",
              sellToken: sellTokenLabel,
              buyToken: buyTokenLabel,
              sellAmount: executedSell,
              buyAmount: executedBuy,
              entryPrice: entryPriceUsd ? `$${entryPriceUsd.toFixed(2)}` : undefined,
              venue: item.execution_venue === "cex" ? `CEX (${agentConfig.exchange || "exchange"})` : "CoW Protocol (MEV-protected)",
            }).catch(() => {});
          }

          filled++;
        } else if (status.invalidated) {
          await supabase
            .from("cow_trade_queue")
            .update({ status: "expired", updated_at: new Date().toISOString() })
            .eq("id", item.id);
        }
      } catch (err: any) {
        console.error(`Status check failed for order ${orderUid}:`, err.message);
      }
    }
  }

  return res.status(200).json({
    checked: (queued?.length || 0) + (quotedTrades?.length || 0) + (signedTrades?.length || 0) + (submittedTrades?.length || 0),
    cow: { quoted, signed, submitted, filled },
    cex: { submitted: cexSubmitted, filled: cexFilled },
  });
}
