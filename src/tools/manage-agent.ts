import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";

export function registerManageAgent(server: McpServer) {
  server.tool(
    "manage_agent",
    "Pause, resume, stop, or fund an existing agent",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Owner wallet address (for authorization)"),
      agentId: z.string().min(1).describe("The agent ID to manage"),
      action: z.enum(["pause", "resume", "stop", "fund"]).describe("Action to perform"),
      fundAmount: z.number().positive().optional().describe("Amount to add (only for 'fund' action)"),
    },
    async ({ walletAddress, agentId, action, fundAmount }) => {
      const supabase = getSupabase();

      // Verify ownership
      const { data: agent, error: fetchErr } = await supabase
        .from("agents")
        .select("*")
        .eq("id", agentId)
        .eq("wallet_address", walletAddress.toLowerCase())
        .single();

      if (fetchErr || !agent) {
        return {
          content: [{ type: "text" as const, text: `Agent not found or not owned by this wallet` }],
          isError: true,
        };
      }

      const statusMap: Record<string, string> = {
        pause: "paused",
        resume: "active",
        stop: "stopped",
      };

      if (action === "fund") {
        if (!fundAmount) {
          return {
            content: [{ type: "text" as const, text: `fundAmount is required for the 'fund' action` }],
            isError: true,
          };
        }

        const walletData = (agent.wallet_data as Record<string, unknown>) || {};
        const currentBudget = (walletData.allocatedBudget as number) || 0;
        const currentRemaining = (walletData.remainingBudget as number) || 0;

        const { error } = await supabase
          .from("agents")
          .update({
            wallet_data: {
              ...walletData,
              allocatedBudget: currentBudget + fundAmount,
              remainingBudget: currentRemaining + fundAmount,
            },
          })
          .eq("id", agentId);

        if (error) {
          return {
            content: [{ type: "text" as const, text: `Failed to fund agent: ${error.message}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                action: "fund",
                agentId,
                addedAmount: fundAmount,
                newAllocated: currentBudget + fundAmount,
                newRemaining: currentRemaining + fundAmount,
              }, null, 2),
            },
          ],
        };
      }

      // pause / resume / stop
      const newStatus = statusMap[action];
      const { error } = await supabase
        .from("agents")
        .update({ status: newStatus })
        .eq("id", agentId);

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Failed to ${action} agent: ${error.message}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: true, action, agentId, newStatus }, null, 2),
          },
        ],
      };
    }
  );
}
