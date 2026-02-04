import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";

export function registerListAgents(server: McpServer) {
  server.tool(
    "list_agents",
    "Query all agents deployed by a specific wallet address",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Owner wallet address (0x...)"),
    },
    async ({ walletAddress }) => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("wallet_address", walletAddress.toLowerCase())
        .order("created_at", { ascending: false });

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Error querying agents: ${error.message}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data ?? [], null, 2),
          },
        ],
      };
    }
  );
}
