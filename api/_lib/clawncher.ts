/**
 * Clawncher SDK wrappers for server-side token deployment and fee claiming.
 * Lazy-singleton pattern — mirrors supabase.ts and neynar.ts.
 */
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
// ClawnchDeployer is exported from deployer.js but NOT re-exported from the
// main SDK index (only its types are). Import it from the subpath directly.
// @ts-expect-error — subpath not in package.json exports map; esbuild resolves it fine
import { ClawnchDeployer } from "@clawnch/clawncher-sdk/dist/deployer.js";
import { ClawncherClaimer, ClawnchReader } from "@clawnch/clawncher-sdk";

const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

// ── Viem client singletons ──

let _publicClient: ReturnType<typeof createPublicClient> | null = null;

function getPublicClient() {
  if (_publicClient) return _publicClient;
  _publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });
  return _publicClient;
}

function getWalletClient() {
  const key = process.env.CLAWNCHER_PRIVATE_KEY;
  if (!key) throw new Error("Missing CLAWNCHER_PRIVATE_KEY");
  const account = privateKeyToAccount(key as `0x${string}`);
  return createWalletClient({
    account,
    chain: base,
    transport: http(BASE_RPC_URL),
  });
}

// ── SDK singletons ──
// Use `any` for singleton types — the SDK's DeployerConfig expects viem
// generics that differ between viem minor versions. Casts are safe because
// the runtime objects are identical.

let _deployer: any = null;
let _claimer: any = null;
let _reader: any = null;

export function getDeployer() {
  if (_deployer) return _deployer;
  _deployer = new ClawnchDeployer({
    wallet: getWalletClient() as any,
    publicClient: getPublicClient() as any,
    network: "mainnet",
  });
  return _deployer;
}

export function getClaimer() {
  if (_claimer) return _claimer;
  _claimer = new ClawncherClaimer({
    wallet: getWalletClient() as any,
    publicClient: getPublicClient() as any,
    network: "mainnet",
  });
  return _claimer;
}

export function getReader() {
  if (_reader) return _reader;
  _reader = new ClawnchReader({
    publicClient: getPublicClient() as any,
    network: "mainnet",
  });
  return _reader;
}

// ── Treasury wallet address ──

export function getFeeRecipient(): string {
  return (
    process.env.CLAWNCHER_FEE_RECIPIENT ||
    process.env.X402_RECEIVING_WALLET ||
    "0x9B767bD2895DE4154195124EF091445F6daa8337"
  );
}

export function getDeployerAddress(): string {
  const key = process.env.CLAWNCHER_PRIVATE_KEY;
  if (!key) throw new Error("Missing CLAWNCHER_PRIVATE_KEY");
  const account = privateKeyToAccount(key as `0x${string}`);
  return account.address;
}
