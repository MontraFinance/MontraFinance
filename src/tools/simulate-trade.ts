/**
 * Tool: simulate_trade
 * Paper trade / dry-run simulator. Shows what a trade would look like
 * at current prices without executing anything.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getTokenPrices, getEthPriceUsd } from "../lib/prices.js";
import { getAllBaseTokens } from "../lib/tokens.js";

export function registerSimulateTrade(server: McpServer) {
  server.tool(
    "simulate_trade",
    "Simulate a trade at current market prices without executing. Shows entry price, fees, slippage estimate, and projected P&L targets — perfect for paper trading and pre-trade analysis",
    {
      tokenIn: z.string().describe("Token you're selling (symbol or address, e.g. 'USDC')"),
      tokenOut: z.string().describe("Token you're buying (symbol or address, e.g. 'ETH')"),
      amountIn: z.number().positive().describe("Amount of tokenIn to spend"),
      slippagePct: z
        .number()
        .min(0)
        .max(50)
        .optional()
        .default(0.5)
        .describe("Expected slippage percentage (default: 0.5%)"),
    },
    async ({ tokenIn, tokenOut, amountIn, slippagePct }) => {
      try {
        // Resolve token addresses and prices
        const tokens = getAllBaseTokens();
        const stablecoins = ["USDC", "USDT", "DAI"];

        const resolvePrice = async (symbol: string): Promise<{ symbol: string; price: number }> => {
          const upper = symbol.toUpperCase();
          if (upper === "ETH" || upper === "WETH") {
            return { symbol: "ETH", price: await getEthPriceUsd() };
          }
          if (stablecoins.includes(upper)) {
            return { symbol: upper, price: 1.0 };
          }

          const isAddress = /^0x[a-fA-F0-9]{40}$/.test(symbol);
          let address: string;
          let sym: string;

          if (isAddress) {
            address = symbol;
            const known = tokens.find((t) => t.address.toLowerCase() === symbol.toLowerCase());
            sym = known?.symbol ?? symbol.slice(0, 8);
          } else {
            const match = tokens.find((t) => t.symbol.toUpperCase() === upper);
            if (!match) {
              return { symbol: upper, price: 0 };
            }
            address = match.address;
            sym = match.symbol;
          }

          const prices = await getTokenPrices([address]);
          return { symbol: sym, price: prices[address.toLowerCase()] ?? 0 };
        };

        const [fromToken, toToken] = await Promise.all([
          resolvePrice(tokenIn),
          resolvePrice(tokenOut),
        ]);

        if (fromToken.price === 0) {
          return {
            content: [{ type: "text" as const, text: `Could not fetch price for ${tokenIn}` }],
            isError: true,
          };
        }
        if (toToken.price === 0) {
          return {
            content: [{ type: "text" as const, text: `Could not fetch price for ${tokenOut}` }],
            isError: true,
          };
        }

        const amountInUsd = amountIn * fromToken.price;
        const swapFeeRate = 0.003; // 0.3% DEX fee
        const feeUsd = amountInUsd * swapFeeRate;
        const slippageUsd = amountInUsd * (slippagePct / 100);
        const netAmountUsd = amountInUsd - feeUsd - slippageUsd;
        const tokensReceived = netAmountUsd / toToken.price;

        // P&L targets
        const targets = [5, 10, 25, 50].map((pct) => {
          const exitPrice = toToken.price * (1 + pct / 100);
          const exitValue = tokensReceived * exitPrice;
          const pnl = exitValue - amountInUsd;
          return {
            targetPct: `+${pct}%`,
            exitPrice: Math.round(exitPrice * 10000) / 10000,
            exitValueUsd: Math.round(exitValue * 100) / 100,
            pnlUsd: Math.round(pnl * 100) / 100,
          };
        });

        // Stop-loss estimates
        const stopLosses = [5, 10, 20].map((pct) => {
          const slPrice = toToken.price * (1 - pct / 100);
          const slValue = tokensReceived * slPrice;
          const loss = slValue - amountInUsd;
          return {
            stopPct: `-${pct}%`,
            triggerPrice: Math.round(slPrice * 10000) / 10000,
            valueUsd: Math.round(slValue * 100) / 100,
            lossUsd: Math.round(loss * 100) / 100,
          };
        });

        const breakEvenPrice = amountInUsd / tokensReceived;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  simulation: true,
                  disclaimer: "Paper trade only — no funds moved",
                  trade: {
                    sell: { token: fromToken.symbol, amount: amountIn, priceUsd: fromToken.price },
                    buy: { token: toToken.symbol, estimatedAmount: Math.round(tokensReceived * 100000) / 100000, priceUsd: toToken.price },
                  },
                  costs: {
                    grossValueUsd: Math.round(amountInUsd * 100) / 100,
                    dexFeeUsd: Math.round(feeUsd * 100) / 100,
                    dexFeeRate: `${swapFeeRate * 100}%`,
                    slippageUsd: Math.round(slippageUsd * 100) / 100,
                    slippagePct: `${slippagePct}%`,
                    netValueUsd: Math.round(netAmountUsd * 100) / 100,
                    totalCostPct: `${Math.round((swapFeeRate * 100 + slippagePct) * 100) / 100}%`,
                  },
                  breakEvenPrice: Math.round(breakEvenPrice * 10000) / 10000,
                  profitTargets: targets,
                  stopLossLevels: stopLosses,
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
          content: [{ type: "text" as const, text: `Trade simulation failed: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}
