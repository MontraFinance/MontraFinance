/**
 * x402 Micropayment Middleware for Vercel Serverless Functions
 *
 * Wraps Vercel API handlers with x402 payment gating.
 * - External callers must pay USDC via the x402 protocol
 * - Internal frontend requests bypass payment (origin check)
 * - Tier holders get discounted rates based on $MONTRA balance
 *
 * Flow:
 * 1. Request arrives → check if it's from our own frontend (bypass)
 * 2. Check for X-PAYMENT header → if missing, return 402 with payment requirements
 * 3. If present → verify payment with Coinbase facilitator → settle → proceed
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Coinbase CDP facilitator for Base mainnet (fee-free USDC settlement)
const FACILITATOR_URL = "https://x402.org/facilitator";

// Receiving wallet for x402 payments
const PAY_TO = process.env.X402_RECEIVING_WALLET || "0x9B767bD2895DE4154195124EF091445F6daa8337";

// USDC on Base mainnet
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Base mainnet in CAIP-2 format
const NETWORK = "eip155:8453";

// Our own frontend origins (bypass payment)
const ALLOWED_ORIGINS = [
  "https://montrafinance.com",
  "https://www.montrafinance.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

// ── Tier discount lookup ──

const TIER_THRESHOLDS: { id: string; minTokens: number; discount: number }[] = [
  { id: "diamond", minTokens: 5_000_000_000, discount: 50 },
  { id: "gold", minTokens: 1_000_000_000, discount: 30 },
  { id: "silver", minTokens: 500_000_000, discount: 15 },
  { id: "bronze", minTokens: 100_000_000, discount: 5 },
  { id: "none", minTokens: 0, discount: 0 },
];

const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

let rpcId = 0;

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(BASE_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const json = (await res.json()) as { result?: string; error?: { message: string } };
  if (json.error) throw new Error(`RPC: ${json.error.message}`);
  return json.result;
}

async function getMontraBalance(walletAddress: string): Promise<number> {
  const tokenAddress = process.env.BURN_TOKEN_ADDRESS || "";
  const tokenDecimals = parseInt(process.env.BURN_TOKEN_DECIMALS || "18", 10);

  if (!tokenAddress || !WALLET_RE.test(tokenAddress)) return 0;

  const data = "0x70a08231" + walletAddress.slice(2).toLowerCase().padStart(64, "0");
  const hex = (await rpcCall("eth_call", [{ to: tokenAddress, data }, "latest"])) as string;
  const raw = BigInt(hex || "0x0");
  const divisor = BigInt(10) ** BigInt(tokenDecimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(tokenDecimals, "0").slice(0, 4);
  return parseFloat(`${whole}.${fracStr}`);
}

function getTierDiscount(balance: number): number {
  const tier = TIER_THRESHOLDS.find((t) => balance >= t.minTokens);
  return tier?.discount || 0;
}

// ── x402 Protocol Helpers ──

interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  payTo: string;
  asset: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown> | null;
}

function buildPaymentRequirements(
  resource: string,
  description: string,
  priceUsd: number,
): PaymentRequirements {
  // USDC has 6 decimals — price in smallest unit
  const amountRaw = Math.ceil(priceUsd * 1_000_000).toString();

  return {
    scheme: "exact",
    network: NETWORK,
    maxAmountRequired: amountRaw,
    resource,
    description,
    payTo: PAY_TO,
    asset: USDC_BASE,
    maxTimeoutSeconds: 300,
    extra: null,
  };
}

function encodePaymentRequired(requirements: PaymentRequirements): string {
  return Buffer.from(JSON.stringify(requirements), "utf-8").toString("base64");
}

async function verifyPayment(
  paymentHeader: string,
  requirements: PaymentRequirements,
): Promise<{ valid: boolean; payer?: string; error?: string }> {
  try {
    // Decode the payment payload from the header
    let paymentPayload: unknown;
    try {
      paymentPayload = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf-8"));
    } catch {
      paymentPayload = JSON.parse(paymentHeader);
    }

    // Verify with the facilitator
    const verifyResp = await fetch(`${FACILITATOR_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload,
        paymentRequirements: requirements,
      }),
    });

    const verifyData = (await verifyResp.json()) as { isValid?: boolean; payer?: string; invalidReason?: string };

    if (!verifyResp.ok || !verifyData.isValid) {
      return { valid: false, error: verifyData.invalidReason || "Payment verification failed" };
    }

    // Settle the payment
    const settleResp = await fetch(`${FACILITATOR_URL}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload,
        paymentRequirements: requirements,
      }),
    });

    const settleData = (await settleResp.json()) as { success?: boolean; payer?: string; errorReason?: string };

    if (!settleResp.ok || !settleData.success) {
      return { valid: false, error: settleData.errorReason || "Payment settlement failed" };
    }

    return { valid: true, payer: settleData.payer || verifyData.payer };
  } catch (err: any) {
    return { valid: false, error: err.message || "Payment processing error" };
  }
}

// ── Route pricing config ──

export interface X402RouteConfig {
  priceUsd: number;       // Base price in USD (USDC)
  description: string;    // Human-readable description of this endpoint
}

// ── Main middleware wrapper ──

/**
 * Wraps a Vercel handler with x402 payment gating.
 *
 * @param config - Route pricing configuration
 * @param handler - The original Vercel handler
 * @returns A new handler that enforces x402 payments for external callers
 */
export function withX402(
  config: X402RouteConfig,
  handler: (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown,
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // 1. Always allow CORS preflight
    if (req.method === "OPTIONS") {
      return handler(req, res);
    }

    // 2. Check if request is from our own frontend — bypass payment
    const origin = req.headers.origin || req.headers.referer || "";
    const isInternal = ALLOWED_ORIGINS.some((o) => origin.startsWith(o))
      || origin.includes("vercel.app")  // our Vercel deployments
      || origin.includes("montrafinance");

    if (isInternal) {
      return handler(req, res);
    }

    // 3. Check for x402 bypass via internal API key
    const apiKey = req.headers["x-api-key"] as string;
    if (apiKey && apiKey === process.env.X402_INTERNAL_API_KEY) {
      return handler(req, res);
    }

    // 4. Determine price (apply tier discount if wallet provided)
    let effectivePrice = config.priceUsd;
    const callerWallet = (req.headers["x-wallet-address"] as string) || "";

    if (WALLET_RE.test(callerWallet)) {
      try {
        const balance = await getMontraBalance(callerWallet);
        const discount = getTierDiscount(balance);
        if (discount > 0) {
          effectivePrice = Math.round(effectivePrice * (1 - discount / 100) * 1_000_000) / 1_000_000;
        }
      } catch {
        // If balance check fails, use full price
      }
    }

    // 5. Build payment requirements for this request
    const resource = req.url || "/";
    const requirements = buildPaymentRequirements(resource, config.description, effectivePrice);

    // 6. Check for payment header
    const paymentHeader = (req.headers["x-payment"] as string) || (req.headers["payment-signature"] as string);

    if (!paymentHeader) {
      // No payment — return 402 with requirements
      const encoded = encodePaymentRequired(requirements);
      res.setHeader("X-PAYMENT-REQUIRED", encoded);
      res.setHeader("Content-Type", "application/json");
      return res.status(402).json({
        error: "Payment Required",
        x402Version: 2,
        paymentRequirements: requirements,
        accepts: [{
          scheme: "exact",
          network: NETWORK,
          maxAmountRequired: requirements.maxAmountRequired,
          asset: USDC_BASE,
          payTo: PAY_TO,
          description: config.description,
          priceUsd: effectivePrice,
        }],
        tierDiscount: callerWallet ? {
          hint: "Include X-Wallet-Address header with your $MONTRA-holding wallet to get tier discounts",
          currentDiscount: effectivePrice < config.priceUsd ? `${Math.round((1 - effectivePrice / config.priceUsd) * 100)}%` : "0%",
        } : {
          hint: "Include X-Wallet-Address header with your $MONTRA-holding wallet to get tier discounts",
        },
      });
    }

    // 7. Verify and settle payment
    const result = await verifyPayment(paymentHeader, requirements);

    if (!result.valid) {
      return res.status(402).json({
        error: "Payment Invalid",
        reason: result.error,
        paymentRequirements: requirements,
      });
    }

    // 8. Log successful payment (fire-and-forget — never blocks response)
    try {
      const { getSupabase } = await import("./supabase.js");
      const supabase = getSupabase();
      const endpointPath = (req.url || "/").split("?")[0];
      supabase.from("x402_payments").insert({
        payer_address: (result.payer || "unknown").toLowerCase(),
        endpoint: endpointPath,
        amount_usdc: effectivePrice,
        amount_raw: requirements.maxAmountRequired,
        tier_discount: effectivePrice < config.priceUsd
          ? Math.round((1 - effectivePrice / config.priceUsd) * 100)
          : 0,
        resource,
        description: config.description,
      }).then(() => {}).catch((err: any) => {
        console.warn("[x402] Payment log failed:", err.message);
      });
    } catch {
      // Never block the main flow for logging
    }

    // 9. Payment verified — add payer info to headers and proceed
    res.setHeader("X-Payment-Payer", result.payer || "unknown");
    res.setHeader("X-Payment-Amount", requirements.maxAmountRequired);
    return handler(req, res);
  };
}
