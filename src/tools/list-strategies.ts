import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { STRATEGIES } from "../lib/strategies.js";

export function registerListStrategies(server: McpServer) {
  server.tool(
    "list_strategies",
    "Returns all 6 available trading strategies with backtest stats, risk levels, and default configs",
    {},
    async () => {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(STRATEGIES, null, 2),
          },
        ],
      };
    }
  );
}
