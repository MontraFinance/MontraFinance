/**
 * GET /api/cron/fee-harvester
 * Vercel cron — runs every 6 hours.
 *
 * Claims accumulated LP fees from all Clawncher-deployed tokens,
 * then swaps the WETH → USDC via CoW Protocol so the buyback-executor
 * can convert USDC → $MONTRA, completing the flywheel.
 *
 * Env vars required:
 *   FEE_HARVESTER_ENABLED=true
 *   CLAWNCHER_PRIVATE_KEY=0x...
 *   CLAWNCHER_FEE_RECIPIENT=0x...  (defaults to X402_RECEIVING_WALLET)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { getClaimer, getReader, getFeeRecipient } from "../_lib/clawncher.js";
import { getCowQuote, submitCowOrder } from "../_lib/cow.js";
import {
  getWethBalanceRaw,
  getWethAllowance,
  approveWethForCow,
  signCowOrder,
  WETH_ADDRESS,
  USDC_ADDRESS,
} from "../_lib/wallet.js";
import { castFeesClaimed } from "../_lib/cast-templates.js";
import type { Address } from "viem";

/** Minimum WETH to trigger a swap (0.0005 WETH ≈ ~$1.50) */
const MIN_WETH_SWAP = BigInt("500000000000000"); // 5e14 wei

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (process.env.FEE_HARVESTER_ENABLED !== "true") {
    return res.status(200).json({ skipped: true, reason: "FEE_HARVESTER_ENABLED is not true" });
  }

  if (!process.env.CLAWNCHER_PRIVATE_KEY) {
    return res.status(200).json({ skipped: true, reason: "CLAWNCHER_PRIVATE_KEY not configured" });
  }

  const supabase = getSupabase();
  const feeRecipient = getFeeRecipient() as Address;

  try {
    // 1. Get all deployed tokens
    const { data: tokens, error } = await supabase
      .from("token_deployments")
      .select("id, token_address, token_symbol")
      .eq("status", "deployed")
      .not("token_address", "is", null);

    if (error || !tokens || tokens.length === 0) {
      return res.status(200).json({ checked: 0, claimed: 0, reason: "No deployed tokens" });
    }

    const reader = getReader();
    const claimer = getClaimer();
    let checked = 0;
    let claimed = 0;

    for (const token of tokens) {
      if (!token.token_address) continue;
      checked++;
      const tokenAddr = token.token_address as Address;

      try {
        // Check available fees
        const fees = await reader.getAvailableFees(feeRecipient, tokenAddr);

        if (fees <= BigInt(0)) continue;

        // Insert pending claim record
        const { data: claimRecord } = await supabase
          .from("fee_claims")
          .insert({
            token_address: token.token_address,
            token_symbol: token.token_symbol,
            status: "pending",
          })
          .select()
          .single();

        // Collect rewards first (triggers LP fee distribution to FeeLocker)
        try {
          await claimer.collectRewards(tokenAddr);
        } catch (collectErr: any) {
          // collectRewards may fail if already collected recently — that's okay
          console.warn(`[fee-harvester] collectRewards for ${token.token_symbol}: ${collectErr.message}`);
        }

        // Claim fees from FeeLocker
        const claimResult = await claimer.claimFees(feeRecipient, tokenAddr);

        // Update claim record
        if (claimRecord) {
          await supabase
            .from("fee_claims")
            .update({
              tx_hash: claimResult.txHash,
              amount_weth: fees.toString(),
              status: "claimed",
            })
            .eq("id", claimRecord.id);
        }

        // Update token's last claim timestamp
        await supabase
          .from("token_deployments")
          .update({
            last_fee_claim_at: new Date().toISOString(),
          })
          .eq("id", token.id);

        claimed++;
        console.log(`[fee-harvester] Claimed fees for ${token.token_symbol}: ${fees.toString()} (tx: ${claimResult.txHash})`);
      } catch (err: any) {
        console.error(`[fee-harvester] Failed for ${token.token_symbol}:`, err.message);

        // Log failed claim
        try {
          await supabase.from("fee_claims").insert({
            token_address: token.token_address,
            token_symbol: token.token_symbol,
            status: "failed",
            error_message: err.message?.slice(0, 500),
          });
        } catch {
          // Ignore logging failure
        }
      }
    }

    // ── WETH → USDC swap via CoW Protocol ──
    let swapResult: { orderUid?: string; wethAmount?: string; approvalTx?: string | null } = {};

    if (claimed > 0) {
      try {
        const privateKey = process.env.CLAWNCHER_PRIVATE_KEY!;
        const wethRaw = await getWethBalanceRaw(feeRecipient);

        if (wethRaw > MIN_WETH_SWAP) {
          // Auto-approve WETH for CoW VaultRelayer if needed
          const allowance = await getWethAllowance(feeRecipient);
          let approvalTx: string | null = null;
          if (allowance < wethRaw) {
            approvalTx = await approveWethForCow(privateKey);
            console.log(`[fee-harvester] Approved WETH for CoW: ${approvalTx}`);
          }

          // Get quote & submit WETH → USDC order
          const sellAmount = wethRaw.toString();
          const quote = await getCowQuote(WETH_ADDRESS, USDC_ADDRESS, sellAmount, feeRecipient, 100);

          const order = {
            sellToken: quote.quote.sellToken,
            buyToken: quote.quote.buyToken,
            sellAmount: quote.quote.sellAmount,
            buyAmount: quote.quote.buyAmount,
            feeAmount: quote.quote.feeAmount,
            validTo: quote.quote.validTo,
            kind: quote.quote.kind,
            receiver: feeRecipient,
            from: feeRecipient,
            appData: "0x0000000000000000000000000000000000000000000000000000000000000000",
            partiallyFillable: false,
            sellTokenBalance: "erc20",
            buyTokenBalance: "erc20",
          };

          const signature = await signCowOrder(order, privateKey);
          const result = await submitCowOrder(order, signature, "eip712");

          const wethHuman = (Number(wethRaw) / 1e18).toFixed(6);
          console.log(`[fee-harvester] WETH→USDC swap submitted: ${wethHuman} WETH (order: ${result.uid})`);

          swapResult = { orderUid: result.uid, wethAmount: wethHuman, approvalTx };
        }
      } catch (swapErr: any) {
        console.error(`[fee-harvester] WETH→USDC swap failed:`, swapErr.message);
        swapResult = { orderUid: undefined, wethAmount: swapErr.message };
      }
    }

    // ── Farcaster announcement ──
    if (claimed > 0) {
      try {
        const totalWethDisplay = swapResult.wethAmount || `${claimed} token(s)`;
        const castText = castFeesClaimed(totalWethDisplay, claimed);
        await supabase.from("farcaster_casts").insert({
          cast_text: castText,
          event_key: `fee_harvest:${new Date().toISOString().slice(0, 13)}`,
        });
      } catch {
        // Non-critical — don't fail the cron over a cast
      }
    }

    return res.status(200).json({
      checked,
      claimed,
      tokens: tokens.length,
      swap: swapResult.orderUid ? swapResult : undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
