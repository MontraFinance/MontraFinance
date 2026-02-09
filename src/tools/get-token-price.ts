import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getTokenPrices, getEthPriceUsd } from "../lib/prices.js";
import { getAllBaseTokens } from "../lib/tokens.js";

export function registerGetTokenPrice(server: McpServer) {
  server.tool(
    "get_token_price",
    "Get the current USD price for any token on Base chain. Supports ETH, USDC, WETH, AERO, cbETH, and any custom token address via DexScreener",
    {
      token: z
        .string()
        .min(1)
        .describe("Token symbol (ETH, USDC, WETH, etc.) or contract address (0x...)"),
    },
    async ({ token }) => {
      const input = token.trim();

      // If it's "ETH" or "eth", fetch ETH price directly
      if (input.toUpperCase() === "ETH") {
        const price = await getEthPriceUsd();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { symbol: "ETH", name: "Ether", address: null, priceUsd: price, chain: "base" },
                null,
                2
              ),
            },
          ],
        };
      }

      // Check if it's a contract address
      const isAddress = /^0x[a-fA-F0-9]{40}$/.test(input);

      let address: string;
      let symbol: string;
      let name: string;

      if (isAddress) {
        address = input;
        // Try to match against known tokens
        const known = getAllBaseTokens().find(
          (t) => t.address.toLowerCase() === input.toLowerCase()
        );
        symbol = known?.symbol ?? input.slice(0, 10);
        name = known?.name ?? "Unknown";
      } else {
        // Look up by symbol
        const knownTokens = getAllBaseTokens();
        const match = knownTokens.find(
          (t) => t.symbol.toUpperCase() === input.toUpperCase()
        );
        if (!match) {
          // List available tokens in the error
          const available = ["ETH", ...knownTokens.map((t) => t.symbol)].join(", ");
          return {
            content: [
              {
                type: "text" as const,
                text: `Token "${input}" not found in curated list. Available: ${available}. You can also pass a contract address (0x...) for any Base token.`,
              },
            ],
            isError: true,
          };
        }
        address = match.address;
        symbol = match.symbol;
        name = match.name;
      }

      const prices = await getTokenPrices([address]);
      const priceUsd = prices[address.toLowerCase()] ?? 0;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { symbol, name, address, priceUsd, chain: "base" },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
