import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";

export function registerGetBurnHistory(server: McpServer) {
  server.tool(
    "get_burn_history",
    "Retrieve burn transaction history for a wallet, showing past $MONTRA burns with status, amounts, and timestamps",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Wallet address to query burn history for"),
      limit: z.number().int().min(1).max(100).optional().describe("Max number of records to return (default 50, max 100)"),
    },
    async ({ walletAddress, limit }) => {
      const supabase = getSupabase();
      const maxRows = limit ?? 50;

      const { data, error, count } = await supabase
        .from("burn_transactions")
        .select("*", { count: "exact" })
        .eq("wallet_address", walletAddress.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(maxRows);

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching burn history: ${error.message}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                wallet: walletAddress,
                burns: data ?? [],
                total: count ?? 0,
                returned: (data ?? []).length,
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
