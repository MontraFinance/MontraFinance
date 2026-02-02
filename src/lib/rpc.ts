const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

let rpcId = 0;

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(BASE_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });

  const json = (await res.json()) as { result?: string; error?: { message: string } };
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

/** Get native ETH balance in wei, returned as a decimal string. */
export async function getNativeBalance(address: string): Promise<string> {
  const hex = (await rpcCall("eth_getBalance", [address, "latest"])) as string;
  return BigInt(hex).toString();
}

/** Get ERC-20 token balance (raw units) for an address. */
export async function getErc20Balance(tokenAddress: string, walletAddress: string): Promise<string> {
  // balanceOf(address) selector = 0x70a08231
  const data = "0x70a08231" + walletAddress.slice(2).toLowerCase().padStart(64, "0");
  const hex = (await rpcCall("eth_call", [{ to: tokenAddress, data }, "latest"])) as string;
  return BigInt(hex).toString();
}

/** Get ERC-20 token decimals. */
export async function getErc20Decimals(tokenAddress: string): Promise<number> {
  // decimals() selector = 0x313ce567
  const hex = (await rpcCall("eth_call", [{ to: tokenAddress, data: "0x313ce567" }, "latest"])) as string;
  return Number(BigInt(hex));
}
