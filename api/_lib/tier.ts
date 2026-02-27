/**
 * Shared tier resolution helper.
 * Reads on-chain $MONTRA balance and resolves holder tier.
 * Used by api/holders/send.ts (and can replace inline logic in api/tiers/check.ts).
 */
import { rpcCall } from "./rpc.js";

export type TierId = "none" | "bronze" | "silver" | "gold" | "diamond";

interface TierDef {
  id: TierId;
  label: string;
  minTokens: number;
}

const TIERS: TierDef[] = [
  { id: "diamond", label: "DIAMOND", minTokens: 5_000_000_000 },
  { id: "gold", label: "GOLD", minTokens: 1_000_000_000 },
  { id: "silver", label: "SILVER", minTokens: 500_000_000 },
  { id: "bronze", label: "BRONZE", minTokens: 100_000_000 },
  { id: "none", label: "UNRANKED", minTokens: 0 },
];

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

async function getErc20Balance(tokenAddress: string, walletAddress: string): Promise<string> {
  const data = "0x70a08231" + walletAddress.slice(2).toLowerCase().padStart(64, "0");
  const hex = (await rpcCall("eth_call", [{ to: tokenAddress, data }, "latest"])) as string;
  return BigInt(hex || "0x0").toString();
}

export function resolveTierId(balance: number): TierId {
  const matched = TIERS.find((t) => balance >= t.minTokens);
  return matched?.id || "none";
}

export async function getWalletTier(walletAddress: string): Promise<{ tier: TierId; balance: number }> {
  const tokenAddress = process.env.BURN_TOKEN_ADDRESS || "";
  const tokenDecimals = parseInt(process.env.BURN_TOKEN_DECIMALS || "18", 10);

  if (!tokenAddress || !WALLET_RE.test(tokenAddress)) {
    return { tier: "none", balance: 0 };
  }

  const rawBalance = await getErc20Balance(tokenAddress, walletAddress);
  const divisor = BigInt(10) ** BigInt(tokenDecimals);
  const whole = BigInt(rawBalance) / divisor;
  const frac = BigInt(rawBalance) % divisor;
  const fracStr = frac.toString().padStart(tokenDecimals, "0").slice(0, 4);
  const balance = parseFloat(`${whole}.${fracStr}`);
  const tier = resolveTierId(balance);

  return { tier, balance };
}
