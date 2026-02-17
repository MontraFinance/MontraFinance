/**
 * Tool: get_alert_subscriptions
 * View all XMTP alert subscriptions for a wallet.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";

export function registerGetAlertSubscriptions(server: McpServer) {
  server.tool(
    "get_alert_subscriptions",
    "View all XMTP alert subscriptions for a wallet — which agents have alerts enabled and what types",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Wallet address"),
    },
    async ({ walletAddress }) => {
      try {
        const supabase = getSupabase();

        const { data, error } = await supabase
          .from("xmtp_subscriptions")
          .select("*")
          .eq("wallet_address", walletAddress.toLowerCase())
          .order("created_at", { ascending: false });

        if (error) throw error;

        const active = (data || []).filter((s: any) => s.enabled);
        const inactive = (data || []).filter((s: any) => !s.enabled);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              walletAddress: walletAddress.toLowerCase(),
              totalSubscriptions: (data || []).length,
              activeCount: active.length,
              inactiveCount: inactive.length,
              subscriptions: (data || []).map((s: any) => ({
                agentId: s.agent_id,
                alertTypes: s.alert_types,
                enabled: s.enabled,
                createdAt: s.created_at,
              })),
            }, null, 2),
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: err.message }, null, 2),
          }],
        };
      }
    }
  );
}
