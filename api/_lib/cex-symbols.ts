/**
 * CEX Symbol Resolution
 * Maps on-chain token addresses to exchange-specific trading pair symbols.
 */

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();
const WETH_BASE = "0x4200000000000000000000000000000000000006".toLowerCase();

// Per-exchange symbol formats for the ETH/USDC pair
const PAIR_SYMBOLS: Record<string, { symbol: string; baseIsEth: boolean }> = {
  binance:  { symbol: "ETHUSDC",  baseIsEth: true },
  coinbase: { symbol: "ETH-USDC", baseIsEth: true },
  bybit:    { symbol: "ETHUSDC",  baseIsEth: true },
  okx:      { symbol: "ETH-USDC", baseIsEth: true },
};

export interface ResolvedSymbol {
  symbol: string;
  side: "buy" | "sell";
  /** For market orders: this is the quantity field */
  quantityToken: "ETH" | "USDC";
}

/**
 * Resolve on-chain token addresses to an exchange symbol + side.
 *
 * Selling USDC to buy WETH  → side: "buy"  (buying ETH)
 * Selling WETH to buy USDC  → side: "sell" (selling ETH)
 */
export function resolveExchangeSymbol(
  exchange: string,
  sellToken: string,
  buyToken: string,
): ResolvedSymbol {
  const sell = sellToken.toLowerCase();
  const buy = buyToken.toLowerCase();
  const pair = PAIR_SYMBOLS[exchange];

  if (!pair) {
    throw new Error(`Unsupported exchange: ${exchange}`);
  }

  // USDC → WETH = buying ETH
  if (sell === USDC_BASE && buy === WETH_BASE) {
    return { symbol: pair.symbol, side: "buy", quantityToken: "USDC" };
  }

  // WETH → USDC = selling ETH
  if (sell === WETH_BASE && buy === USDC_BASE) {
    return { symbol: pair.symbol, side: "sell", quantityToken: "ETH" };
  }

  throw new Error(`Unsupported token pair: ${sellToken} → ${buyToken}. Only ETH/USDC supported for CEX trading.`);
}

/**
 * Convert raw sell amount (with decimals baked in) to a human-readable quantity string.
 * USDC has 6 decimals, WETH has 18.
 */
export function formatQuantity(sellAmountRaw: string, sellToken: string): string {
  const sell = sellToken.toLowerCase();
  if (sell === USDC_BASE) {
    // USDC 6 decimals → dollar amount
    return (Number(BigInt(sellAmountRaw)) / 1e6).toFixed(2);
  }
  // WETH 18 decimals
  return (Number(BigInt(sellAmountRaw)) / 1e18).toFixed(8);
}
