/**
 * Tool: get_gpu_status
 * Get detailed status of a specific Vast.ai GPU instance including
 * real-time GPU utilization, temperature, SSH info, and cost.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const VAST_API = "https://console.vast.ai/api/v0";

export function registerGetGpuStatus(server: McpServer) {
  server.tool(
    "get_gpu_status",
    "Get detailed real-time status of a specific Vast.ai GPU instance — utilization, temperature, memory, SSH info, and cost breakdown",
    {
      instance_id: z.number().int().positive().describe("Vast.ai instance ID"),
    },
    async ({ instance_id }) => {
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
          method: "GET",
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${key}`,
          },
        });

        if (!res.ok) throw new Error(`Vast.ai API returned ${res.status}`);

        const i = await res.json();
        const uptimeHrs = i.duration ? (i.duration / 3600).toFixed(1) : "0";

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                instance_id: i.id,
                gpu_name: i.gpu_name,
                num_gpus: i.num_gpus,
                gpu_ram_mb: i.gpu_ram,
                cpu_ram_mb: i.cpu_ram,
                disk_gb: i.disk_space,
                status: i.actual_status || i.intended_status,
                cur_state: i.cur_state,
                // SSH
                ssh_host: i.ssh_host,
                ssh_port: i.ssh_port,
                ssh_command: i.ssh_host
                  ? `ssh -p ${i.ssh_port} root@${i.ssh_host} -L 8080:localhost:8080`
                  : "Instance not ready yet",
                // GPU metrics
                gpu_utilization: i.gpu_util != null ? `${i.gpu_util}%` : "N/A",
                gpu_temperature: i.gpu_temp != null ? `${i.gpu_temp}°C` : "N/A",
                // Cost
                price_per_hour: `$${(i.dph_total || 0).toFixed(3)}`,
                total_cost: `$${(i.total_cost || 0).toFixed(2)}`,
                uptime_hours: uptimeHrs,
                // Meta
                image: i.image_uuid,
                location: i.geolocation,
                cuda_version: i.cuda_max_good,
                driver_version: i.driver_version,
                start_date: i.start_date ? new Date(i.start_date * 1000).toISOString() : null,
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
