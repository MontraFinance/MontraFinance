/**
 * GET /api/cron/fee-harvester
 * Vercel cron — runs every 6 hours.
 *
 * Claims accumulated LP fees from all Clawncher-deployed tokens.
 * Claimed WETH accumulates in the treasury wallet where the
 * buyback-executor can pick it up for $MONTRA buys/burns.
 *
 * Env vars required:
 *   FEE_HARVESTER_ENABLED=true
 *   CLAWNCHER_PRIVATE_KEY=0x...
 *   CLAWNCHER_FEE_RECIPIENT=0x...  (defaults to X402_RECEIVING_WALLET)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { getClaimer, getReader, getFeeRecipient } from "../_lib/clawncher.js";
import type { Address } from "viem";

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

    return res.status(200).json({
      checked,
      claimed,
      tokens: tokens.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
