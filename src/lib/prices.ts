const CACHE_TTL = 60_000;
const STALE_TTL = 300_000;

interface PriceCacheEntry {
  usd: number;
  timestamp: number;
}

const priceCache = new Map<string, PriceCacheEntry>();

// WETH on Base — used to derive ETH price
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

/**
 * Fetch USD prices for multiple token addresses on Base via DexScreener.
 * Returns a map of lowercase address → USD price.
 * Tokens without a trading pair return 0.
 */
export async function getTokenPrices(addresses: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const toFetch: string[] = [];

  // Check cache first
  for (const addr of addresses) {
    const key = addr.toLowerCase();
    const cached = priceCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      result[key] = cached.usd;
    } else {
      toFetch.push(addr);
    }
  }

  if (toFetch.length === 0) return result;

  // DexScreener supports comma-separated addresses (up to ~30)
  const batchSize = 30;
  for (let i = 0; i < toFetch.length; i += batchSize) {
    const batch = toFetch.slice(i, i + batchSize);
    const joined = batch.join(",");

    try {
      const resp = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${joined}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!resp.ok) throw new Error(`DexScreener ${resp.status}`);

      const data = await resp.json();
      const pairs: any[] = data.pairs || [];

      // Group pairs by base token address (on Base chain)
      const bestPrice = new Map<string, number>();
      for (const pair of pairs) {
        if (pair.chainId !== "base") continue;
        const tokenAddr = pair.baseToken?.address?.toLowerCase();
        if (!tokenAddr) continue;

        const priceUsd = parseFloat(pair.priceUsd);
        if (isNaN(priceUsd) || priceUsd <= 0) continue;

        const liquidity = pair.liquidity?.usd || 0;
        const existing = bestPrice.get(tokenAddr);
        // Keep price from highest-liquidity pair
        if (!existing || liquidity > (bestPrice.get(tokenAddr + "_liq") || 0)) {
          bestPrice.set(tokenAddr, priceUsd);
          bestPrice.set(tokenAddr + "_liq", liquidity);
        }
      }

      // Also check quote token side (for tokens listed as quote)
      for (const pair of pairs) {
        if (pair.chainId !== "base") continue;
        const tokenAddr = pair.quoteToken?.address?.toLowerCase();
        if (!tokenAddr) continue;
        if (bestPrice.has(tokenAddr)) continue;

        // For quote tokens, price is inverse of priceUsd * priceNative
        // Skip — DexScreener priceUsd is for the base token
      }

      for (const addr of batch) {
        const key = addr.toLowerCase();
        const price = bestPrice.get(key) ?? 0;
        result[key] = price;
        priceCache.set(key, { usd: price, timestamp: Date.now() });
      }
    } catch {
      // On failure, use stale cache or default to 0
      for (const addr of batch) {
        const key = addr.toLowerCase();
        const stale = priceCache.get(key);
        if (stale && Date.now() - stale.timestamp < STALE_TTL) {
          result[key] = stale.usd;
        } else {
          result[key] = 0;
        }
      }
    }
  }

  return result;
}

/**
 * Get the current ETH price in USD using the WETH pair on DexScreener.
 */
export async function getEthPriceUsd(): Promise<number> {
  const prices = await getTokenPrices([WETH_ADDRESS]);
  return prices[WETH_ADDRESS.toLowerCase()] || 0;
}
