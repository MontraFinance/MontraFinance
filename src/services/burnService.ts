/**
 * Burn service — API calls + ERC-20 ABI encoding for token burns on Base.
 * No ethers/viem dependency; raw EIP-1193 + manual ABI encoding.
 */
import type { EVMProvider } from "@/types/wallet";
import type { BurnEstimate, BurnSubmission, BurnVerification, BurnHistoryResponse } from "@/types/burn";

const API_BASE = "/api/burn";

// ─── ABI Encoding (vanilla — no libraries) ────────────────────────────

/** Encode ERC-20 transfer(address,uint256) */
function encodeTransfer(to: string, amount: bigint): string {
  const selector = "0xa9059cbb"; // keccak256("transfer(address,uint256)") first 4 bytes
  const toParam = to.toLowerCase().replace("0x", "").padStart(64, "0");
  const amountParam = amount.toString(16).padStart(64, "0");
  return selector + toParam + amountParam;
}

/** Encode ERC-20 balanceOf(address) */
function encodeBalanceOf(owner: string): string {
  const selector = "0x70a08231"; // keccak256("balanceOf(address)") first 4 bytes
  const ownerParam = owner.toLowerCase().replace("0x", "").padStart(64, "0");
  return selector + ownerParam;
}

/** Convert a human-readable token amount to raw BigInt with decimals */
function toRawAmount(amount: number, decimals: number): bigint {
  // Use string multiplication to avoid floating-point precision issues
  const parts = amount.toString().split(".");
  const whole = parts[0];
  const frac = (parts[1] || "").slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole + frac);
}

// ─── API Calls ─────────────────────────────────────────────────────────

export async function estimateBurn(query: string): Promise<BurnEstimate> {
  const resp = await fetch(`${API_BASE}/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) throw new Error(`Estimate failed: ${resp.status}`);
  return resp.json();
}

export async function submitBurn(
  walletAddress: string,
  query: string,
  tokenAmount: number,
  complexity: string
): Promise<BurnSubmission> {
  const resp = await fetch(`${API_BASE}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, query, tokenAmount, complexity }),
  });
  if (!resp.ok) throw new Error(`Submit failed: ${resp.status}`);
  return resp.json();
}

export async function processBurn(
  burnId: string,
  txHash: string
): Promise<BurnVerification> {
  const resp = await fetch(`${API_BASE}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ burnId, txHash }),
  });
  if (!resp.ok) throw new Error(`Process failed: ${resp.status}`);
  return resp.json();
}

// ─── On-Chain Operations ───────────────────────────────────────────────

/** Check ERC-20 token balance for a wallet */
export async function checkTokenBalance(
  provider: EVMProvider,
  tokenAddress: string,
  walletAddress: string,
  decimals: number
): Promise<number> {
  const data = encodeBalanceOf(walletAddress);
  const result = (await provider.request({
    method: "eth_call",
    params: [{ to: tokenAddress, data }, "latest"],
  })) as string;

  const raw = BigInt(result || "0x0");
  // Convert to human-readable
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 4);
  return parseFloat(`${whole}.${fracStr}`);
}

/** Send ERC-20 transfer to dead address (burn) */
export async function executeBurnTransaction(
  provider: EVMProvider,
  tokenAddress: string,
  deadAddress: string,
  amount: number,
  decimals: number
): Promise<string> {
  const rawAmount = toRawAmount(amount, decimals);
  const data = encodeTransfer(deadAddress, rawAmount);

  // Get the connected account
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  if (!accounts.length) throw new Error("No connected account");

  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: accounts[0],
        to: tokenAddress,
        data,
      },
    ],
  })) as string;

  return txHash;
}

// ─── Burn History ─────────────────────────────────────────────────────

/** Get burn transaction history for a wallet (ported from QT getBurnHistory) */
export async function getBurnHistory(
  walletAddress: string,
  limit: number = 50
): Promise<BurnHistoryResponse> {
  try {
    const resp = await fetch(
      `${API_BASE}/history?wallet=${encodeURIComponent(walletAddress)}&limit=${limit}`
    );
    if (!resp.ok) {
      return { success: false, burns: [], total: 0 };
    }
    return resp.json();
  } catch {
    return { success: false, burns: [], total: 0 };
  }
}

// ─── Client-Side Cost Estimator ───────────────────────────────────────
// Mirrors server-side complexity-tiered USD pricing for instant UI preview.
// Actual cost is authoritative from the server /api/burn/estimate response.

const BURN_BASE_USD = 0.25;

const VERY_COMPLEX_INDICATORS = ["backtest", "monte carlo", "portfolio", "correlation", "regression", "optimization", "strategy"];
const COMPLEX_INDICATORS = ["analyze", "compare", "trend", "forecast", "prediction", "signal", "indicator"];

const USD_TIERS: Record<string, number> = { simple: 1, medium: 3, complex: 10, very_complex: 32 };

function clientAnalyzeComplexity(query: string): string {
  const q = query.toLowerCase();
  if (VERY_COMPLEX_INDICATORS.some((i) => q.includes(i))) return "very_complex";
  if (COMPLEX_INDICATORS.some((i) => q.includes(i))) return "complex";
  if (query.length > 200) return "medium";
  return "simple";
}

/** Client-side cost estimator — returns tiered USD cost for instant UI preview */
export function estimateTokenCost(query: string): { usdCost: number; total: number; complexity: string } {
  if (!query.trim()) return { usdCost: 0, total: 0, complexity: "simple" };
  const complexity = clientAnalyzeComplexity(query);
  const tier = USD_TIERS[complexity] || 1;
  const usdCost = parseFloat((BURN_BASE_USD * tier).toFixed(2));
  return { usdCost, total: 0, complexity };
}

// ─── Feature Flag ─────────────────────────────────────────────────────

/** Check if burn is enabled (client-side env) */
export function isBurnEnabled(): boolean {
  return import.meta.env.VITE_BURN_ENABLED === "true";
}
