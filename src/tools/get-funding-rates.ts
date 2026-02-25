/**
 * Tool: get_funding_rates
 * Fetch perpetual futures funding rates from Coinglass.
 * Provides direct access without routing through the generic get_market_data gateway.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface FundingRate {
  symbol: string;
  rate: number;
  annualized: number;
  nextFunding: string | null;
  exchange: string;
}

export function registerGetFundingRates(server: McpServer) {
  server.tool(
    "get_funding_rates",
    "Get current perpetual futures funding rates from Coinglass — shows which assets are overleveraged long or short. Essential for gauging market positioning and identifying crowded trades",
    {
      symbol: z
        .string()
        .optional()
        .describe("Asset symbol (e.g. 'BTC', 'ETH'). Omit for top assets overview"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of assets to return (default: 10)"),
    },
    async ({ symbol, limit }) => {
      const apiKey = process.env.COINGLASS_KEY;
      if (!apiKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "COINGLASS_KEY not configured",
                hint: "Set COINGLASS_KEY environment variable to enable funding rate data",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const url = symbol
          ? `https://open-api-v3.coinglass.com/api/futures/funding-rate?symbol=${symbol.toUpperCase()}`
          : `https://open-api-v3.coinglass.com/api/futures/funding-rate-list?limit=${limit}`;

        const resp = await fetch(url, {
          headers: { accept: "application/json", CG_API_KEY: apiKey },
          signal: AbortSignal.timeout(8000),
        });

        if (!resp.ok) {
          return {
            content: [{ type: "text" as const, text: `Coinglass returned ${resp.status}` }],
            isError: true,
          };
        }

        const data = await resp.json();

        if (symbol) {
          // Single asset — format exchange-by-exchange rates
          const rates = data.data || [];
          const exchanges: FundingRate[] = (Array.isArray(rates) ? rates : [rates]).map((r: any) => ({
            symbol: symbol.toUpperCase(),
            exchange: r.exchangeName || r.exchange || "unknown",
            rate: r.rate != null ? r.rate : r.fundingRate || 0,
            annualized: r.rate != null ? r.rate * 365 * 3 : 0, // 8h funding * 3 * 365
            nextFunding: r.nextFundingTime || null,
          }));

          const avgRate = exchanges.length > 0
            ? exchanges.reduce((s, e) => s + e.rate, 0) / exchanges.length
            : 0;

          const bias =
            avgRate > 0.01 ? "EXTREME_LONG" :
            avgRate > 0.005 ? "HEAVY_LONG" :
            avgRate > 0 ? "SLIGHTLY_LONG" :
            avgRate > -0.005 ? "SLIGHTLY_SHORT" :
            avgRate > -0.01 ? "HEAVY_SHORT" : "EXTREME_SHORT";

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    symbol: symbol.toUpperCase(),
                    averageRate: Math.round(avgRate * 10000) / 10000,
                    averageAnnualized: `${Math.round(avgRate * 365 * 3 * 10000) / 100}%`,
                    marketBias: bias,
                    exchanges: exchanges.slice(0, 10),
                    timestamp: new Date().toISOString(),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Multi-asset overview
        const assets: any[] = data.data || [];
        const formatted = assets.slice(0, limit).map((a: any) => {
          const rate = a.rate ?? a.fundingRate ?? a.currentFundingRate ?? 0;
          return {
            symbol: a.symbol || "?",
            rate: Math.round(rate * 10000) / 10000,
            annualizedPct: `${Math.round(rate * 365 * 3 * 10000) / 100}%`,
            openInterest: a.openInterest ?? a.oi ?? null,
            bias: rate > 0.005 ? "LONG" : rate < -0.005 ? "SHORT" : "NEUTRAL",
          };
        });

        // Summary stats
        const longBiased = formatted.filter((f) => f.bias === "LONG").length;
        const shortBiased = formatted.filter((f) => f.bias === "SHORT").length;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  totalAssets: formatted.length,
                  marketSummary: {
                    longBiased,
                    shortBiased,
                    neutral: formatted.length - longBiased - shortBiased,
                    overallBias: longBiased > shortBiased ? "NET_LONG" : shortBiased > longBiased ? "NET_SHORT" : "BALANCED",
                  },
                  assets: formatted,
                  timestamp: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Funding rates fetch failed: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}
