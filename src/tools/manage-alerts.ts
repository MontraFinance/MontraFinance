/**
 * Tool: manage_alerts
 * Subscribe or unsubscribe a wallet from XMTP agent alerts.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";

export function registerManageAlerts(server: McpServer) {
  server.tool(
    "manage_alerts",
    "Subscribe or unsubscribe a wallet from XMTP agent alerts (trade, milestone, burn notifications)",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Wallet address"),
      agentId: z.string().describe("Agent ID to manage alerts for"),
      action: z.enum(["subscribe", "unsubscribe", "update"]).describe("Action to perform"),
      alertTypes: z.array(z.enum(["trade", "milestone", "burn", "status"])).optional()
        .describe("Alert types (default: trade, milestone, burn)"),
    },
    async ({ walletAddress, agentId, action, alertTypes }) => {
      try {
        const supabase = getSupabase();
        const wallet = walletAddress.toLowerCase();

        if (action === "unsubscribe") {
          const { error } = await supabase
            .from("xmtp_subscriptions")
            .update({ enabled: false })
            .eq("wallet_address", wallet)
            .eq("agent_id", agentId);

          if (error) throw error;

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                action: "unsubscribed",
                walletAddress: wallet,
                agentId,
              }, null, 2),
            }],
          };
        }

        if (action === "subscribe") {
          const types = alertTypes || ["trade", "milestone", "burn"];

          const { data, error } = await supabase
            .from("xmtp_subscriptions")
            .upsert({
              wallet_address: wallet,
              agent_id: agentId,
              alert_types: types,
              enabled: true,
            }, { onConflict: "wallet_address,agent_id" })
            .select("*")
            .single();

          if (error) throw error;

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                action: "subscribed",
                subscription: data,
              }, null, 2),
            }],
          };
        }

        // update
        if (action === "update" && alertTypes) {
          const { data, error } = await supabase
            .from("xmtp_subscriptions")
            .update({ alert_types: alertTypes })
            .eq("wallet_address", wallet)
            .eq("agent_id", agentId)
            .select("*")
            .single();

          if (error) throw error;

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                action: "updated",
                subscription: data,
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: "Invalid action or missing alertTypes for update" }, null, 2),
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
