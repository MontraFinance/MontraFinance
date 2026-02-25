/**
 * Tool: destroy_gpu_instance
 * Terminate and destroy a running Vast.ai GPU instance.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const VAST_API = "https://console.vast.ai/api/v0";

export function registerDestroyGpuInstance(server: McpServer) {
  server.tool(
    "destroy_gpu_instance",
    "Terminate and destroy a running Vast.ai GPU instance. This action is irreversible — all data on the instance will be lost",
    {
      instance_id: z.number().int().positive().describe("Vast.ai instance ID to destroy"),
      confirm: z
        .boolean()
        .describe("Must be true to confirm destruction. This is a safety check."),
    },
    async ({ instance_id, confirm }) => {
      if (!confirm) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Destruction not confirmed",
                message: "Set confirm: true to destroy this instance. This action is irreversible.",
              }),
            },
          ],
        };
      }

      const key = process.env.VAST_AI_API_KEY;
      if (!key) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "VAST_AI_API_KEY not configured",
                hint: "Set VAST_AI_API_KEY in your environment variables",
              }),
            },
          ],
        };
      }

      try {
        const res = await fetch(`${VAST_API}/instances/${instance_id}/`, {
          method: "DELETE",
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${key}`,
          },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Vast.ai API ${res.status}: ${text}`);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                instance_id,
                message: "Instance has been destroyed. All data has been deleted.",
              }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: err.message }) }],
        };
      }
    }
  );
}
