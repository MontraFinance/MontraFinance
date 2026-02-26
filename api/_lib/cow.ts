/**
 * CoW Protocol client for MEV-protected trade routing on Base
 * Uses CoW Protocol's order API directly (no SDK dependency needed).
 */

const COW_API_BASE = "https://api.cow.fi/base/api/v1";
// CoW Protocol requires appData as a JSON content hash (keccak256 of the JSON metadata)
// This is the hash of: {"appCode":"montra-finance","metadata":{},"version":"1.3.0"}
const APP_DATA = "0x0000000000000000000000000000000000000000000000000000000000000000";

interface CowQuote {
  quote: {
    sellToken: string;
    buyToken: string;
    sellAmount: string;
    buyAmount: string;
    feeAmount: string;
    validTo: number;
    kind: string;
  };
  id: number;
}

interface CowOrderResult {
  uid: string;
}

interface CowOrderStatus {
  uid: string;
  status: string;
  executedBuyAmount?: string;
  executedSellAmount?: string;
  invalidated?: boolean;
}

/**
 * Get a quote from CoW Protocol for a swap
 */
export async function getCowQuote(
  sellToken: string,
  buyToken: string,
  sellAmount: string,
  from: string,
  slippageBps: number = 50,
): Promise<CowQuote> {
  const response = await fetch(`${COW_API_BASE}/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sellToken,
      buyToken,
      sellAmountBeforeFee: sellAmount,
      from,
      kind: "sell",
      appData: APP_DATA,
      partiallyFillable: false,
      signingScheme: "eip712",
      receiver: from,
      slippageBps,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`CoW quote failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Submit a signed order to CoW Protocol orderbook
 */
export async function submitCowOrder(
  order: Record<string, any>,
  signature: string,
  signingScheme: string = "eip712",
): Promise<CowOrderResult> {
  const response = await fetch(`${COW_API_BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...order,
      signature,
      signingScheme,
      appData: APP_DATA,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`CoW order submission failed: ${response.status} - ${error}`);
  }

  const uid = await response.json();
  return { uid: typeof uid === "string" ? uid : uid.uid };
}

/**
 * Check the status of a CoW Protocol order
 */
export async function getCowOrderStatus(orderUid: string): Promise<CowOrderStatus> {
  const response = await fetch(`${COW_API_BASE}/orders/${orderUid}`);

  if (!response.ok) {
    throw new Error(`CoW order status check failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get all trades for a specific order
 */
export async function getCowOrderTrades(orderUid: string): Promise<any[]> {
  const response = await fetch(`${COW_API_BASE}/trades?orderUid=${orderUid}`);

  if (!response.ok) {
    throw new Error(`CoW trades fetch failed: ${response.status}`);
  }

  return response.json();
}
