import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const HELSINKI_BASE = process.env.HELSINKI_BASE || "http://77.42.29.188:5002";
const COINGLASS_BASE = "https://open-api-v3.coinglass.com/api";
const WHALE_ALERT_BASE = "https://api.whale-alert.io/v1";

export function registerGetMarketData(server: McpServer) {
  server.tool(
    "get_market_data",
    "Fetch live market data from Coinglass (derivatives/funding/OI), Helsinki VM (quant/sentiment), or Whale Alert (large transactions)",
    {
      source: z
        .enum(["coinglass", "helsinki", "whale_alert"])
        .describe("Data source: coinglass (derivatives data), helsinki (quant/sentiment), whale_alert (large txns)"),
      path: z
        .string()
        .optional()
        .describe(
          "API path — Coinglass: /futures/funding-rate, /futures/open-interest-his, /futures/liquidation-history. " +
          "Helsinki: /quant/full/BTC, /sentiment/BTC, /derivatives/BTC. " +
          "Whale Alert: not used (leave empty)"
        ),
      symbol: z
        .string()
        .optional()
        .describe("Trading symbol, e.g. BTC, ETH (used by Coinglass and Helsinki)"),
      minValue: z
        .number()
        .optional()
        .describe("Whale Alert only: minimum USD transaction value (default 1000000)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Whale Alert only: max transactions to return (default 5)"),
    },
    async ({ source, path, symbol, minValue, limit }) => {
      try {
        if (source === "coinglass") {
          const apiKey = process.env.COINGLASS_KEY || "";
          if (!apiKey) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "COINGLASS_KEY not configured", data: null }) }],
            };
          }

          const cgPath = path || "/futures/funding-rate";
          if (!cgPath.startsWith("/futures/")) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "Coinglass path must start with /futures/" }) }],
              isError: true,
            };
          }

          const url = new URL(`${COINGLASS_BASE}${cgPath}`);
          if (symbol) url.searchParams.set("symbol", symbol);

          const resp = await fetch(url.toString(), {
            headers: { coinglassSecret: apiKey },
            signal: AbortSignal.timeout(8000),
          });

          if (!resp.ok) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: `Coinglass returned ${resp.status}` }) }],
              isError: true,
            };
          }

          const data = await resp.json();
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        }

        if (source === "helsinki") {
          let hPath = path || `/quant/full/${symbol || "BTC"}`;
          if (
            !hPath.startsWith("/quant/") &&
            !hPath.startsWith("/sentiment/") &&
            !hPath.startsWith("/derivatives/")
          ) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "Helsinki path must start with /quant/, /sentiment/, or /derivatives/" }) }],
              isError: true,
            };
          }

          const resp = await fetch(`${HELSINKI_BASE}${hPath}`, {
            signal: AbortSignal.timeout(8000),
          });

          if (!resp.ok) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ _unavailable: true, _upstream: resp.status }) }],
            };
          }

          const data = await resp.json();
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        }

        if (source === "whale_alert") {
          const apiKey = process.env.WHALE_ALERT_KEY || "";
          if (!apiKey) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: "WHALE_ALERT_KEY not configured", transactions: [] }) }],
            };
          }

          const params = new URLSearchParams({
            api_key: apiKey,
            min_value: String(minValue || 1_000_000),
            start: String(Math.floor(Date.now() / 1000) - 3600),
            limit: String(limit || 5),
          });

          const resp = await fetch(`${WHALE_ALERT_BASE}/transactions?${params}`, {
            signal: AbortSignal.timeout(8000),
          });

          if (!resp.ok) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: `Whale Alert returned ${resp.status}` }) }],
              isError: true,
            };
          }

          const data = await resp.json();
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Unknown source" }) }],
          isError: true,
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error fetching market data: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}
