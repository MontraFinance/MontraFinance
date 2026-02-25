/**
 * GET /api/cron/buyback-executor
 * Vercel cron — runs every 15 minutes.
 *
 * Checks USDC balance in the x402 receiving wallet.
 * If balance exceeds threshold, submits a USDC -> MONTRA buyback via CoW Protocol.
 * The purchased MONTRA can optionally be burned (future enhancement).
 *
 * Env vars required:
 *   BUYBACK_ENABLED=true
 *   BUYBACK_THRESHOLD_USDC=100     (minimum USDC to trigger)
 *   BUYBACK_PERCENT=80             (% of balance to use)
 *   BUYBACK_PRIVATE_KEY=0x...      (treasury wallet private key — Vercel secrets only)
 *   X402_RECEIVING_WALLET=0x...    (treasury wallet address)
 *   BURN_TOKEN_ADDRESS=0x...       (MONTRA token address)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabase } from "../_lib/supabase.js";
import { getCowQuote, submitCowOrder } from "../_lib/cow.js";
import { rpcCall } from "../_lib/rpc.js";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;
// CoW Settlement contract on Base
const COW_SETTLEMENT = "0x9008D19f58AAbD9eD0D60971565AA8510560ab41";

/**
 * Read ERC-20 balance via raw RPC call (no ethers dependency).
 */
async function getUsdcBalance(wallet: string): Promise<number> {
  const data = "0x70a08231" + wallet.slice(2).toLowerCase().padStart(64, "0");
  const hex = (await rpcCall("eth_call", [{ to: USDC_ADDRESS, data }, "latest"])) as string;
  const raw = BigInt(hex || "0x0");
  return Number(raw) / 10 ** USDC_DECIMALS;
}

/**
 * Sign a CoW Protocol order using EIP-712.
 * Uses ethers.js Wallet for signing (available in project deps).
 */
async function signCowOrder(
  order: Record<string, any>,
  privateKey: string,
): Promise<string> {
  // Dynamic import — only loaded when buyback actually executes
  const { ethers } = await import("ethers");
  const wallet = new ethers.Wallet(privateKey);

  const domain = {
    name: "Gnosis Protocol",
    version: "v2",
    chainId: 8453,
    verifyingContract: COW_SETTLEMENT,
  };

  const types = {
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

  const orderData = {
    sellToken: order.sellToken,
    buyToken: order.buyToken,
    receiver: order.receiver || order.from,
    sellAmount: order.sellAmount,
    buyAmount: order.buyAmount,
    validTo: order.validTo,
    appData: order.appData || "0x0000000000000000000000000000000000000000000000000000000000000000",
    feeAmount: order.feeAmount || "0",
    kind: order.kind || "sell",
    partiallyFillable: false,
    sellTokenBalance: "erc20",
    buyTokenBalance: "erc20",
  };

  return wallet.signTypedData(domain, types, orderData);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Auth
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Feature flag
  if (process.env.BUYBACK_ENABLED !== "true") {
    return res.status(200).json({ skipped: true, reason: "BUYBACK_ENABLED is not true" });
  }

  // Config
  const THRESHOLD = parseFloat(process.env.BUYBACK_THRESHOLD_USDC || "100");
  const PERCENT = parseFloat(process.env.BUYBACK_PERCENT || "80");
  const PRIVATE_KEY = process.env.BUYBACK_PRIVATE_KEY;
  const RECEIVING_WALLET = process.env.X402_RECEIVING_WALLET || "0x9B767bD2895DE4154195124EF091445F6daa8337";
  const MONTRA_ADDRESS = process.env.BURN_TOKEN_ADDRESS;

  if (!PRIVATE_KEY) {
    return res.status(200).json({ skipped: true, reason: "BUYBACK_PRIVATE_KEY not configured" });
  }
  if (!MONTRA_ADDRESS) {
    return res.status(200).json({ skipped: true, reason: "BURN_TOKEN_ADDRESS not configured" });
  }

  try {
    // 1. Check USDC balance
    const balance = await getUsdcBalance(RECEIVING_WALLET);

    if (balance < THRESHOLD) {
      return res.status(200).json({
        skipped: true,
        balance: Math.round(balance * 100) / 100,
        threshold: THRESHOLD,
        reason: "Balance below threshold",
      });
    }

    // 2. Calculate buyback amount
    const buybackUsdc = Math.floor(balance * (PERCENT / 100) * 1e6) / 1e6;
    const sellAmountRaw = String(Math.floor(buybackUsdc * 1e6));

    // 3. Get CoW quote
    const quote = await getCowQuote(
      USDC_ADDRESS,
      MONTRA_ADDRESS,
      sellAmountRaw,
      RECEIVING_WALLET,
      100, // 1% slippage for automated execution
    );

    // 4. Build the order
    const order = {
      sellToken: quote.quote.sellToken,
      buyToken: quote.quote.buyToken,
      sellAmount: quote.quote.sellAmount,
      buyAmount: quote.quote.buyAmount,
      feeAmount: quote.quote.feeAmount,
      validTo: quote.quote.validTo,
      kind: quote.quote.kind,
      receiver: RECEIVING_WALLET,
      from: RECEIVING_WALLET,
      appData: "0x0000000000000000000000000000000000000000000000000000000000000000",
      partiallyFillable: false,
      sellTokenBalance: "erc20",
      buyTokenBalance: "erc20",
    };

    // 5. Sign the order
    const signature = await signCowOrder(order, PRIVATE_KEY);

    // 6. Submit to CoW
    const result = await submitCowOrder(order, signature, "eip712");

    // 7. Log to database
    const supabase = getSupabase();
    await supabase.from("buyback_orders").insert({
      order_uid: result.uid,
      usdc_amount: buybackUsdc,
      status: "pending",
      trigger_balance: Math.round(balance * 1e6) / 1e6,
      cow_quote_data: quote,
    });

    return res.status(200).json({
      executed: true,
      orderUid: result.uid,
      usdcAmount: buybackUsdc,
      expectedMontra: quote.quote.buyAmount,
      triggerBalance: Math.round(balance * 100) / 100,
    });
  } catch (err: any) {
    // Log failure but don't crash
    try {
      const supabase = getSupabase();
      await supabase.from("buyback_orders").insert({
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
