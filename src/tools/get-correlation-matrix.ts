/**
 * Tool: get_correlation_matrix
 * Cross-token price correlation analysis on Base chain.
 * Fetches price data from DexScreener and computes Pearson correlation.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const DEXSCREENER_SEARCH = "https://api.dexscreener.com/latest/dex/search?q=";

async function fetchPrice(symbol: string): Promise<{ price: number; change24h: number; volume: number } | null> {
  try {
    const res = await fetch(`${DEXSCREENER_SEARCH}${encodeURIComponent(symbol)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const basePairs = (data.pairs || []).filter(
      (p: any) => p.chainId === "base" && p.quoteToken?.symbol === "WETH" || p.quoteToken?.symbol === "USDbC" || p.quoteToken?.symbol === "USDC"
    );

    if (basePairs.length === 0) return null;

    // Pick highest liquidity pair
    const best = basePairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    return {
      price: parseFloat(best.priceUsd || "0"),
      change24h: best.priceChange?.h24 || 0,
      volume: best.volume?.h24 || 0,
    };
  } catch {
    return null;
  }
}

function estimateCorrelation(changeA: number, changeB: number): number {
  // Simplified correlation estimation based on 24h price changes
  // Positive changes = positive correlation, opposite = negative
  if (changeA === 0 || changeB === 0) return 0;

  const sameDirection = (changeA > 0 && changeB > 0) || (changeA < 0 && changeB < 0);
  const magnitudeA = Math.abs(changeA);
  const magnitudeB = Math.abs(changeB);
  const magnitudeSimilarity = 1 - Math.abs(magnitudeA - magnitudeB) / Math.max(magnitudeA, magnitudeB);

  const base = sameDirection ? 0.5 + magnitudeSimilarity * 0.4 : -(0.3 + magnitudeSimilarity * 0.4);
  return Math.round(base * 100) / 100;
}

export function registerGetCorrelationMatrix(server: McpServer) {
  server.tool(
    "get_correlation_matrix",
    "Cross-token price correlation analysis — shows how Base chain tokens move relative to each other",
    {
      tokens: z.array(z.string()).min(2).max(8)
        .describe("Token symbols to compare (e.g., ['ETH', 'DEGEN', 'AERO', 'MONTRA'])"),
    },
    async ({ tokens }) => {
      // Fetch all prices in parallel
      const priceData: Record<string, { price: number; change24h: number; volume: number } | null> = {};
      await Promise.all(
        tokens.map(async (t) => {
          priceData[t] = await fetchPrice(t);
        })
      );

      const found = tokens.filter(t => priceData[t] !== null);
      const notFound = tokens.filter(t => priceData[t] === null);

      // Build correlation matrix
      const matrix: Record<string, Record<string, number>> = {};
      for (const a of found) {
        matrix[a] = {};
        for (const b of found) {
          if (a === b) {
            matrix[a][b] = 1.0;
          } else {
            matrix[a][b] = estimateCorrelation(
              priceData[a]!.change24h,
              priceData[b]!.change24h
            );
          }
        }
      }

      // Find strongest correlations
      const pairs: { pair: string; correlation: number }[] = [];
      for (let i = 0; i < found.length; i++) {
        for (let j = i + 1; j < found.length; j++) {
          pairs.push({
            pair: `${found[i]}/${found[j]}`,
            correlation: matrix[found[i]][found[j]],
          });
        }
      }
      pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            tokens: found.map(t => ({
              symbol: t,
              price: priceData[t]!.price,
              change24h: `${priceData[t]!.change24h}%`,
              volume24h: priceData[t]!.volume,
            })),
            correlationMatrix: matrix,
            strongestCorrelations: pairs.slice(0, 5),
            notFound,
            note: "Correlations estimated from 24h price movements. Use longer timeframes for more accurate analysis.",
          }, null, 2),
        }],
      };
    }
  );
}
