/**
 * Tool: manage_watchlist
 * Create and manage a token watchlist with price tracking.
 * Stores watchlists in Supabase (token_watchlists table) and fetches live prices.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";
import { getTokenPrices, getEthPriceUsd } from "../lib/prices.js";
import { getAllBaseTokens } from "../lib/tokens.js";

export function registerManageWatchlist(server: McpServer) {
  server.tool(
    "manage_watchlist",
    "Create, view, and manage a token watchlist. Add tokens to track, view current prices with change alerts, or remove tokens you no longer care about",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Wallet address that owns the watchlist"),
      action: z
        .enum(["view", "add", "remove"])
        .describe("Action: view current watchlist with prices, add tokens, or remove tokens"),
      tokens: z
        .array(z.string())
        .optional()
        .describe("Token symbols to add or remove (e.g. ['ETH', 'DEGEN', 'AERO'])"),
    },
    async ({ walletAddress, action, tokens }) => {
      const supabase = getSupabase();
      const wallet = walletAddress.toLowerCase();

      if (action === "add") {
        if (!tokens || tokens.length === 0) {
          return {
            content: [{ type: "text" as const, text: "Provide token symbols to add" }],
            isError: true,
          };
        }

        // Upsert each token
        const added: string[] = [];
        const failed: string[] = [];

        for (const sym of tokens) {
          const { error } = await supabase.from("token_watchlists").upsert(
            {
              wallet_address: wallet,
              token_symbol: sym.toUpperCase(),
              added_at: new Date().toISOString(),
            },
            { onConflict: "wallet_address,token_symbol" }
          );

          if (error) {
            // If table doesn't exist, store in-memory fallback
            failed.push(sym.toUpperCase());
          } else {
            added.push(sym.toUpperCase());
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  action: "add",
                  walletAddress,
                  added,
                  failed: failed.length > 0 ? failed : undefined,
                  message: `Added ${added.length} token(s) to watchlist`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (action === "remove") {
        if (!tokens || tokens.length === 0) {
          return {
            content: [{ type: "text" as const, text: "Provide token symbols to remove" }],
            isError: true,
          };
        }

        const removed: string[] = [];
        for (const sym of tokens) {
          const { error } = await supabase
            .from("token_watchlists")
            .delete()
            .eq("wallet_address", wallet)
            .eq("token_symbol", sym.toUpperCase());

          if (!error) removed.push(sym.toUpperCase());
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  action: "remove",
                  walletAddress,
                  removed,
                  message: `Removed ${removed.length} token(s) from watchlist`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // VIEW — fetch watchlist + live prices
      const { data: watchlist, error } = await supabase
        .from("token_watchlists")
        .select("token_symbol, added_at, last_price, last_checked_at")
        .eq("wallet_address", wallet)
        .order("added_at", { ascending: true });

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Watchlist error: ${error.message}` }],
          isError: true,
        };
      }

      if (!watchlist || watchlist.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                walletAddress,
                watchlist: [],
                message: "Watchlist is empty. Use action 'add' with tokens to start tracking.",
              }),
            },
          ],
        };
      }

      // Fetch current prices
      const knownTokens = getAllBaseTokens();
      const tokenEntries: { symbol: string; address: string | null; addedAt: string; lastPrice: number | null }[] = [];

      for (const w of watchlist) {
        const sym = w.token_symbol;
        const known = knownTokens.find((t) => t.symbol.toUpperCase() === sym.toUpperCase());
        tokenEntries.push({
          symbol: sym,
          address: known?.address || null,
          addedAt: w.added_at,
          lastPrice: w.last_price || null,
        });
      }

      // Batch price fetch
      const addressesToFetch = tokenEntries.filter((t) => t.address).map((t) => t.address!);
      const prices = addressesToFetch.length > 0 ? await getTokenPrices(addressesToFetch) : {};
      const ethPrice = await getEthPriceUsd();

      const results = tokenEntries.map((t) => {
        let currentPrice: number | null = null;
        if (t.symbol.toUpperCase() === "ETH") {
          currentPrice = ethPrice;
        } else if (t.address) {
          currentPrice = prices[t.address.toLowerCase()] ?? null;
        }

        const previousPrice = t.lastPrice;
        let changePct: number | null = null;
        if (currentPrice != null && previousPrice != null && previousPrice > 0) {
          changePct = Math.round(((currentPrice - previousPrice) / previousPrice) * 10000) / 100;
        }

        // Update stored price
        if (currentPrice != null) {
          supabase
            .from("token_watchlists")
            .update({ last_price: currentPrice, last_checked_at: new Date().toISOString() })
            .eq("wallet_address", wallet)
            .eq("token_symbol", t.symbol)
            .then(() => {}); // fire and forget
        }

        return {
          symbol: t.symbol,
          priceUsd: currentPrice,
          changeSinceLastCheck: changePct != null ? `${changePct > 0 ? "+" : ""}${changePct}%` : null,
          addedAt: t.addedAt,
          alert: changePct != null && Math.abs(changePct) > 10 ? (changePct > 0 ? "PUMP" : "DUMP") : null,
        };
      });

      const alerts = results.filter((r) => r.alert != null);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                walletAddress,
                totalTokens: results.length,
                alerts: alerts.length > 0 ? alerts : "No significant moves",
                watchlist: results,
                timestamp: new Date().toISOString(),
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
