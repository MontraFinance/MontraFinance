/**
 * Client-side token transfer helpers for Base chain.
 * Uses raw EIP-1193 provider calls — no ethers/viem dependency.
 * Supports: USDC, MONTRA (ERC-20), and native ETH.
 * Pattern follows src/services/burnService.ts.
 */
import type { EVMProvider } from "@/types/wallet";

// USDC on Base (6 decimals)
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_DECIMALS = 6;
const BASE_CHAIN_ID = "0x2105"; // 8453

// MONTRA token on Base (18 decimals)
// Fetched once at runtime from the burn estimate API
let _montraToken: string | null = null;
let _montraDecimals = 18;

async function getMontraTokenAddress(): Promise<string> {
  if (_montraToken) return _montraToken;
  try {
    const res = await fetch("/api/burn/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test" }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.tokenAddress) {
        _montraToken = data.tokenAddress;
        _montraDecimals = data.tokenDecimals || 18;
        return _montraToken;
      }
    }
  } catch {}
  throw new Error("MONTRA token address not available — burn system may be offline");
}

/** Ensure the wallet is connected to Base network, switch if needed */
async function ensureBaseNetwork(provider: EVMProvider): Promise<void> {
  const chainId = (await provider.request({ method: "eth_chainId" })) as string;
  if (chainId.toLowerCase() === BASE_CHAIN_ID) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_CHAIN_ID }],
    });
  } catch (switchError: any) {
    // Chain not added — add it
    if (switchError.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: BASE_CHAIN_ID,
          chainName: "Base",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://mainnet.base.org"],
          blockExplorerUrls: ["https://basescan.org"],
        }],
      });
    } else {
      throw new Error("Please switch your wallet to Base network to continue.");
    }
  }
}

/** Encode ERC-20 transfer(address,uint256) */
function encodeTransfer(to: string, amount: bigint): string {
  const selector = "0xa9059cbb";
  const toParam = to.toLowerCase().replace("0x", "").padStart(64, "0");
  const amountParam = amount.toString(16).padStart(64, "0");
  return selector + toParam + amountParam;
}

/** Encode ERC-20 balanceOf(address) */
function encodeBalanceOf(owner: string): string {
  const selector = "0x70a08231";
  const ownerParam = owner.toLowerCase().replace("0x", "").padStart(64, "0");
  return selector + ownerParam;
}

/** Convert human-readable USDC amount to raw BigInt (6 decimals) */
function toRawUsdc(amount: number): bigint {
  const parts = amount.toString().split(".");
  const whole = parts[0];
  const frac = (parts[1] || "").slice(0, USDC_DECIMALS).padEnd(USDC_DECIMALS, "0");
  return BigInt(whole + frac);
}

/**
 * Transfer USDC to an agent's wallet address on Base.
 * Returns the transaction hash.
 */
export async function transferUsdcToAgent(
  provider: EVMProvider,
  agentAddress: string,
  amount: number,
): Promise<string> {
  // Force switch to Base network before sending
  await ensureBaseNetwork(provider);

  const rawAmount = toRawUsdc(amount);
  const data = encodeTransfer(agentAddress, rawAmount);

  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  if (!accounts.length) throw new Error("No connected account");

  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: accounts[0],
        to: USDC_BASE,
        data,
      },
    ],
  })) as string;

  return txHash;
}

/**
 * Get USDC balance for an address on Base.
 * Returns human-readable amount (e.g. 100.50).
 */
export async function getUsdcBalance(
  provider: EVMProvider,
  address: string,
): Promise<number> {
  await ensureBaseNetwork(provider);

  const data = encodeBalanceOf(address);
  const result = (await provider.request({
    method: "eth_call",
    params: [{ to: USDC_BASE, data }, "latest"],
  })) as string;

  const raw = BigInt(result || "0x0");
  const divisor = BigInt(10) ** BigInt(USDC_DECIMALS);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(USDC_DECIMALS, "0").slice(0, 2);
  return parseFloat(`${whole}.${fracStr}`);
}

// ── ETH helpers ──

/** Convert human-readable ETH to wei hex string */
function ethToWei(amount: number): string {
  // Multiply by 1e18 using string math to avoid floating point issues
  const parts = amount.toString().split(".");
  const whole = parts[0];
  const frac = (parts[1] || "").slice(0, 18).padEnd(18, "0");
  const wei = BigInt(whole + frac);
  return "0x" + wei.toString(16);
}

/**
 * Transfer native ETH to an agent's wallet address on Base.
 * Agents need ETH for gas fees (approvals, burns, etc.).
 */
export async function transferEthToAgent(
  provider: EVMProvider,
  agentAddress: string,
  amount: number,
): Promise<string> {
  await ensureBaseNetwork(provider);

  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  if (!accounts.length) throw new Error("No connected account");

  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [{
      from: accounts[0],
      to: agentAddress,
      value: ethToWei(amount),
    }],
  })) as string;

  return txHash;
}

/**
 * Get native ETH balance for an address on Base.
 */
export async function getEthBalance(
  provider: EVMProvider,
  address: string,
): Promise<number> {
  await ensureBaseNetwork(provider);

  const result = (await provider.request({
    method: "eth_getBalance",
    params: [address, "latest"],
  })) as string;

  const wei = BigInt(result || "0x0");
  const divisor = BigInt(10) ** BigInt(18);
  const whole = wei / divisor;
  const frac = wei % divisor;
  // Show 6 decimal places for ETH
  const fracStr = frac.toString().padStart(18, "0").slice(0, 6);
  return parseFloat(`${whole}.${fracStr}`);
}

// ── MONTRA helpers ──

/** Convert human-readable MONTRA amount to raw BigInt */
function toRawMontra(amount: number, decimals: number): bigint {
  const parts = amount.toString().split(".");
  const whole = parts[0];
  const frac = (parts[1] || "").slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole + frac);
}

/**
 * Transfer MONTRA tokens to an agent's wallet on Base.
 * Agents need MONTRA for AI consultation burns.
 */
export async function transferMontraToAgent(
  provider: EVMProvider,
  agentAddress: string,
  amount: number,
): Promise<string> {
  await ensureBaseNetwork(provider);

  const tokenAddr = await getMontraTokenAddress();
  const rawAmount = toRawMontra(amount, _montraDecimals);
  const data = encodeTransfer(agentAddress, rawAmount);

  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  if (!accounts.length) throw new Error("No connected account");

  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [{
      from: accounts[0],
      to: tokenAddr,
      data,
    }],
  })) as string;

  return txHash;
}

/**
 * Get MONTRA token balance for an address on Base.
 */
export async function getMontraBalance(
  provider: EVMProvider,
  address: string,
): Promise<number> {
  await ensureBaseNetwork(provider);

  let tokenAddr: string;
  try {
    tokenAddr = await getMontraTokenAddress();
  } catch {
    return 0;
  }

  const data = encodeBalanceOf(address);
  const result = (await provider.request({
    method: "eth_call",
    params: [{ to: tokenAddr, data }, "latest"],
  })) as string;

  const raw = BigInt(result || "0x0");
  const divisor = BigInt(10) ** BigInt(_montraDecimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(_montraDecimals, "0").slice(0, 2);
  return parseFloat(`${whole}.${fracStr}`);
}
