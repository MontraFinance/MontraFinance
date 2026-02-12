import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerGetLiquidity(server: McpServer) {
  server.tool(
    "get_liquidity",
    "Check DEX liquidity depth for a token on Base chain — shows all trading pairs, liquidity, volume, and price impact estimates",
    {
      tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Token contract address on Base"),
    },
    async ({ tokenAddress }) => {
      try {
        const resp = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
          { signal: AbortSignal.timeout(8000) }
        );

        if (!resp.ok) {
          return {
            content: [{ type: "text" as const, text: `DexScreener returned ${resp.status}` }],
            isError: true,
          };
        }

        const data = await resp.json();
        const allPairs: any[] = data.pairs || [];
        const basePairs = allPairs.filter((p: any) => p.chainId === "base");

        if (basePairs.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  tokenAddress,
                  chain: "base",
                  pairsFound: 0,
                  totalLiquidityUsd: 0,
                  hint: "No trading pairs found on Base for this token.",
                }, null, 2),
              },
            ],
          };
        }

        // Sort by liquidity
        const sorted = basePairs.sort(
          (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        );

        const totalLiquidity = sorted.reduce((s: number, p: any) => s + (p.liquidity?.usd || 0), 0);
        const totalVolume24h = sorted.reduce((s: number, p: any) => s + (p.volume?.h24 || 0), 0);

        const pairs = sorted.slice(0, 15).map((p: any) => ({
          pairAddress: p.pairAddress,
          dex: p.dexId,
          baseToken: p.baseToken?.symbol,
          quoteToken: p.quoteToken?.symbol,
          priceUsd: parseFloat(p.priceUsd) || 0,
          priceChange24h: p.priceChange?.h24 ?? null,
          liquidityUsd: p.liquidity?.usd ?? 0,
          liquidityBase: p.liquidity?.base ?? 0,
          liquidityQuote: p.liquidity?.quote ?? 0,
          volume24h: p.volume?.h24 ?? 0,
          volume6h: p.volume?.h6 ?? 0,
          volume1h: p.volume?.h1 ?? 0,
          txns24h: {
            buys: p.txns?.h24?.buys ?? 0,
            sells: p.txns?.h24?.sells ?? 0,
          },
          url: p.url || null,
        }));

        // Liquidity depth assessment
        const depthRating =
          totalLiquidity >= 1_000_000 ? "deep" :
          totalLiquidity >= 100_000 ? "moderate" :
          totalLiquidity >= 10_000 ? "thin" : "very_thin";

        // Rough price impact estimates based on liquidity
        const estimatePriceImpact = (tradeUsd: number) => {
          if (totalLiquidity <= 0) return "N/A";
          // Simplified constant product: impact ≈ tradeSize / (2 * liquidity)
          const impact = (tradeUsd / (2 * totalLiquidity)) * 100;
          return `~${Math.round(impact * 100) / 100}%`;
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  tokenAddress,
                  chain: "base",
                  totalLiquidityUsd: Math.round(totalLiquidity),
                  totalVolume24h: Math.round(totalVolume24h),
                  pairsFound: basePairs.length,
                  depthRating,
                  estimatedPriceImpact: {
                    "$100": estimatePriceImpact(100),
                    "$1,000": estimatePriceImpact(1000),
                    "$10,000": estimatePriceImpact(10000),
                    "$100,000": estimatePriceImpact(100000),
                  },
                  pairs,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Liquidity check failed: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}
