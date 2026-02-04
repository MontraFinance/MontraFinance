import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getNativeBalance, getErc20Balance } from "../lib/rpc.js";
import { getAllBaseTokens } from "../lib/tokens.js";
import { getTokenPrices, getEthPriceUsd } from "../lib/prices.js";

interface Holding {
  symbol: string;
  name: string;
  address: string | null;
  balance: string;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
}

export function registerGetPortfolio(server: McpServer) {
  server.tool(
    "get_portfolio",
    "Scan wallet for native ETH + all known Base chain ERC-20 tokens, returning balances with USD valuations",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Wallet address to query"),
      tokenAddresses: z
        .array(z.string().regex(/^0x[a-fA-F0-9]{40}$/))
        .optional()
        .describe("Optional extra ERC-20 token addresses to include beyond the curated list"),
    },
    async ({ walletAddress, tokenAddresses }) => {
      const holdings: Holding[] = [];
      const tokens = getAllBaseTokens();

      // Merge any extra token addresses the caller specified
      if (tokenAddresses) {
        for (const addr of tokenAddresses) {
          if (!tokens.some((t) => t.address.toLowerCase() === addr.toLowerCase())) {
            tokens.push({ address: addr, symbol: addr.slice(0, 10), name: "Unknown", decimals: 18 });
          }
        }
      }

      // Fetch native ETH balance
      const ethWei = await getNativeBalance(walletAddress);
      const ethBalance = Number(ethWei) / 1e18;

      // Fetch all ERC-20 balances in parallel
      const balanceResults = await Promise.allSettled(
        tokens.map(async (token) => {
          const raw = await getErc20Balance(token.address, walletAddress);
          const balance = Number(raw) / 10 ** token.decimals;
          return { token, balance, raw };
        })
      );

      // Collect non-zero token addresses for price lookup
      const nonZeroTokens: { token: typeof tokens[0]; balance: number }[] = [];
      for (const res of balanceResults) {
        if (res.status === "fulfilled" && res.value.balance > 0) {
          nonZeroTokens.push({ token: res.value.token, balance: res.value.balance });
        }
      }

      // Batch fetch prices for non-zero tokens + ETH
      const addressesToPrice = nonZeroTokens.map((t) => t.token.address);
      const [tokenPrices, ethPriceUsd] = await Promise.all([
        addressesToPrice.length > 0
          ? getTokenPrices(addressesToPrice)
          : Promise.resolve({} as Record<string, number>),
        ethBalance > 0 ? getEthPriceUsd() : Promise.resolve(0),
      ]);

      // Add ETH holding
      if (ethBalance > 0) {
        holdings.push({
          symbol: "ETH",
          name: "Ether",
          address: null,
          balance: ethBalance.toFixed(6),
          decimals: 18,
          priceUsd: ethPriceUsd,
          valueUsd: Math.round(ethBalance * ethPriceUsd * 100) / 100,
        });
      }

      // Add ERC-20 holdings
      for (const { token, balance } of nonZeroTokens) {
        const price = tokenPrices[token.address.toLowerCase()] ?? 0;
        holdings.push({
          symbol: token.symbol,
          name: token.name,
          address: token.address,
          balance: balance.toFixed(6),
          decimals: token.decimals,
          priceUsd: price,
          valueUsd: Math.round(balance * price * 100) / 100,
        });
      }

      // Sort by value descending
      holdings.sort((a, b) => b.valueUsd - a.valueUsd);

      const totalValueUsd = Math.round(holdings.reduce((sum, h) => sum + h.valueUsd, 0) * 100) / 100;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                wallet: walletAddress,
                chain: "base",
                totalValueUsd,
                holdingsCount: holdings.length,
                holdings,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
