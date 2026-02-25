/**
 * Tool: get_gpu_instances
 * List all running GPU instances on your Vast.ai account with
 * status, cost, SSH info, and GPU utilization.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const VAST_API = "https://console.vast.ai/api/v0";

export function registerGetGpuInstances(server: McpServer) {
  server.tool(
    "get_gpu_instances",
    "List all your running Vast.ai GPU instances with status, SSH details, GPU utilization, cost, and uptime",
    {},
    async () => {
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
        const res = await fetch(`${VAST_API}/instances/`, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${key}`,
          },
        });

        if (!res.ok) throw new Error(`Vast.ai API returned ${res.status}`);

        const data = await res.json();
        const instances = (data.instances || []).map((i: any) => {
          const status = i.actual_status || i.intended_status || "unknown";
          const uptimeHrs = i.duration ? (i.duration / 3600).toFixed(1) : "0";
          return {
            id: i.id,
            gpu_name: i.gpu_name,
            num_gpus: i.num_gpus,
            gpu_ram_mb: i.gpu_ram,
            status,
            ssh_host: i.ssh_host,
            ssh_port: i.ssh_port,
            ssh_command: i.ssh_host
              ? `ssh -p ${i.ssh_port} root@${i.ssh_host} -L 8080:localhost:8080`
              : null,
            gpu_utilization: i.gpu_util != null ? `${i.gpu_util}%` : "N/A",
            gpu_temp: i.gpu_temp != null ? `${i.gpu_temp}°C` : "N/A",
            price_per_hour: `$${(i.dph_total || 0).toFixed(3)}`,
            total_cost: `$${(i.total_cost || 0).toFixed(2)}`,
            uptime_hours: uptimeHrs,
            image: i.image_uuid,
            location: i.geolocation,
          };
        });

        const totalCost = instances.reduce(
          (s: number, i: any) => s + parseFloat(i.total_cost.replace("$", "")),
          0,
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                instances,
                count: instances.length,
                total_spend: `$${totalCost.toFixed(2)}`,
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
