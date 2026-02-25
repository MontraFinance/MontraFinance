/**
 * Tool: search_gpu_offers
 * Search Vast.ai marketplace for available GPU instances matching requirements.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const VAST_API = "https://console.vast.ai/api/v0";

export function registerSearchGpuOffers(server: McpServer) {
  server.tool(
    "search_gpu_offers",
    "Search Vast.ai GPU marketplace for available offers. Filter by GPU model, count, RAM, and max price per hour",
    {
      gpu_name: z
        .string()
        .optional()
        .default("RTX_5090")
        .describe("GPU model name (e.g. 'RTX_5090', 'RTX_4090', 'A100_SXM4', 'H100_SXM5')"),
      num_gpus: z
        .number()
        .int()
        .min(1)
        .max(8)
        .optional()
        .default(4)
        .describe("Minimum number of GPUs required"),
      max_price: z
        .number()
        .positive()
        .optional()
        .default(5.0)
        .describe("Maximum price per hour in USD"),
      min_ram: z
        .number()
        .int()
        .optional()
        .default(28000)
        .describe("Minimum GPU RAM in MB per GPU"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Maximum number of results to return"),
    },
    async ({ gpu_name, num_gpus, max_price, min_ram, limit }) => {
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
        const query = {
          verified: { eq: true },
          rentable: { eq: true },
          num_gpus: { gte: num_gpus },
          gpu_name: { eq: gpu_name },
          gpu_ram: { gte: min_ram },
          dph_total: { lte: max_price },
        };

        const res = await fetch(`${VAST_API}/bundles/`, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`,
          },
          body: JSON.stringify(query),
        });

        if (!res.ok) {
          throw new Error(`Vast.ai API returned ${res.status}`);
        }

        const data = await res.json();
        const offers = (data.offers || []).slice(0, limit).map((o: any) => ({
          id: o.id,
          gpu_name: o.gpu_name,
          num_gpus: o.num_gpus,
          gpu_ram_mb: o.gpu_ram,
          cpu_ram_mb: o.cpu_ram,
          disk_gb: o.disk_space,
          price_per_hour: `$${o.dph_total?.toFixed(3)}`,
          dl_performance: o.dlperf,
          bandwidth_up: `${o.inet_up} Mbps`,
          bandwidth_down: `${o.inet_down} Mbps`,
          reliability: `${((o.reliability2 || 0) * 100).toFixed(1)}%`,
          location: o.geolocation,
          cuda_version: o.cuda_max_good,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                query: { gpu_name, num_gpus, max_price, min_ram },
                offers,
                count: offers.length,
                total_available: data.offers?.length || 0,
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
