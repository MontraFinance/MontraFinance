/**
 * Shared wallet utilities for server-side ERC-20 operations and CoW signing.
 * Used by buyback-executor, sentiment-trader, and any future server-side trading cron.
 */
import { rpcCall } from "./rpc.js";

export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const USDC_DECIMALS = 6;
export const COW_SETTLEMENT = "0x9008D19f58AAbD9eD0D60971565AA8510560ab41";
export const COW_VAULT_RELAYER = "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110";
const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

/**
 * Read ERC-20 balance via raw RPC call (no ethers dependency).
 */
export async function getUsdcBalance(wallet: string): Promise<number> {
  const data = "0x70a08231" + wallet.slice(2).toLowerCase().padStart(64, "0");
  const hex = (await rpcCall("eth_call", [{ to: USDC_ADDRESS, data }, "latest"])) as string;
  const raw = BigInt(hex || "0x0");
  return Number(raw) / 10 ** USDC_DECIMALS;
}

/**
 * Check ERC-20 allowance for CoW VaultRelayer.
 */
export async function getUsdcAllowance(owner: string): Promise<bigint> {
  const data =
    "0xdd62ed3e" +
    owner.slice(2).toLowerCase().padStart(64, "0") +
    COW_VAULT_RELAYER.slice(2).toLowerCase().padStart(64, "0");
  const hex = (await rpcCall("eth_call", [{ to: USDC_ADDRESS, data }, "latest"])) as string;
  return BigInt(hex || "0x0");
}

/**
 * Send a raw signed transaction to approve USDC spending by CoW VaultRelayer.
 */
export async function approveUsdcForCow(privateKey: string): Promise<string> {
  const { ethers } = await import("ethers");
  const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";
  const provider = new ethers.JsonRpcProvider(rpcUrl, 8453);
  const wallet = new ethers.Wallet(privateKey, provider);

  const iface = new ethers.Interface(["function approve(address spender, uint256 amount)"]);
  const txData = iface.encodeFunctionData("approve", [COW_VAULT_RELAYER, MAX_UINT256]);

  const tx = await wallet.sendTransaction({ to: USDC_ADDRESS, data: txData });
  const receipt = await tx.wait();
  return receipt?.hash || tx.hash;
}

/**
 * Sign a CoW Protocol order using EIP-712.
 */
export async function signCowOrder(
  order: Record<string, any>,
  privateKey: string,
): Promise<string> {
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
