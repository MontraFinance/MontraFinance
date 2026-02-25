/**
 * Tool: rent_gpu_instance
 * Rent a GPU instance from Vast.ai marketplace by offer ID.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const VAST_API = "https://console.vast.ai/api/v0";

export function registerRentGpuInstance(server: McpServer) {
  server.tool(
    "rent_gpu_instance",
    "Rent a GPU instance on Vast.ai by specifying an offer ID. Optionally provide a Docker image, disk size, and startup commands",
    {
      offer_id: z.number().int().positive().describe("Offer ID from search_gpu_offers results"),
      image: z
        .string()
        .optional()
        .default("pytorch/pytorch:2.5.1-cuda12.4-cudnn9-devel")
        .describe("Docker image to use"),
      disk_gb: z
        .number()
        .int()
        .min(10)
        .max(500)
        .optional()
        .default(80)
        .describe("Disk space in GB"),
      onstart_cmd: z
        .string()
        .optional()
        .describe("Shell command to run on instance startup (e.g. install dependencies)"),
    },
    async ({ offer_id, image, disk_gb, onstart_cmd }) => {
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
        const payload: Record<string, any> = {
          client_id: "me",
          image,
          disk: disk_gb,
        };

        if (onstart_cmd) {
          payload.onstart_cmd = onstart_cmd;
        } else {
          payload.onstart_cmd =
            "apt-get update && apt-get install -y git && pip install vllm transformers peft trl bitsandbytes datasets accelerate safetensors huggingface_hub";
        }

        const res = await fetch(`${VAST_API}/asks/${offer_id}/`, {
          method: "PUT",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Vast.ai API ${res.status}: ${text}`);
        }

        const data = await res.json();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                instance_id: data.new_contract,
                status: "creating",
                image,
                disk_gb,
                message: "Instance is being provisioned. Use get_gpu_instances to check status.",
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
