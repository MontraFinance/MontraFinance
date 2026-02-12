import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Search for any token on Base chain via DexScreener search API.
 * Goes beyond the curated 8-token list — finds anything with a DEX pair.
 */

export function registerSearchTokens(server: McpServer) {
  server.tool(
    "search_tokens",
    "Search for any token trading on Base chain by name or symbol using DexScreener. Returns price, liquidity, pair info, and contract address",
    {
      query: z.string().min(1).max(100).describe("Token name or symbol to search for (e.g. 'BRETT', 'DEGEN', 'aerodrome')"),
    },
    async ({ query }) => {
      try {
        const resp = await fetch(
          `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
          { signal: AbortSignal.timeout(8000) }
        );

        if (!resp.ok) {
          return {
            content: [{ type: "text" as const, text: `DexScreener returned ${resp.status}` }],
            isError: true,
          };
        }

        const data = await resp.json();
        const pairs: any[] = data.pairs || [];

        // Filter to Base chain only
        const basePairs = pairs.filter((p: any) => p.chainId === "base");

        if (basePairs.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  query,
                  chain: "base",
                  resultsCount: 0,
                  results: [],
                  hint: "No Base chain pairs found. The token may trade on another chain.",
                }, null, 2),
              },
            ],
          };
        }

        // Deduplicate by base token address, keep highest-liquidity pair per token
        const tokenMap = new Map<string, any>();
        for (const pair of basePairs) {
          const addr = pair.baseToken?.address?.toLowerCase();
          if (!addr) continue;

          const existing = tokenMap.get(addr);
          const liq = pair.liquidity?.usd || 0;
          if (!existing || liq > (existing.liquidity?.usd || 0)) {
            tokenMap.set(addr, pair);
          }
        }

        const results = Array.from(tokenMap.values())
          .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
          .slice(0, 10)
          .map((p) => ({
            symbol: p.baseToken?.symbol || "?",
            name: p.baseToken?.name || "Unknown",
            address: p.baseToken?.address || null,
            priceUsd: parseFloat(p.priceUsd) || 0,
            priceChange24h: p.priceChange?.h24 ?? null,
            volume24h: p.volume?.h24 ?? 0,
            liquidityUsd: p.liquidity?.usd ?? 0,
            pairAddress: p.pairAddress,
            dexId: p.dexId,
            url: p.url || null,
          }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { query, chain: "base", resultsCount: results.length, results },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Search failed: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}
