import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";

export function registerGetFarcasterActivity(server: McpServer) {
  server.tool(
    "get_farcaster_activity",
    "Monitor Farcaster autonomous posting: view recent casts, check failure rates, and see pending/posted/failed status breakdown",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Max casts to return (default 20)"),
      statusFilter: z
        .enum(["all", "posted", "failed", "pending"])
        .optional()
        .describe("Filter by cast status (default: all)"),
    },
    async ({ limit, statusFilter }) => {
      const supabase = getSupabase();
      const maxRows = limit ?? 20;

      // Get status breakdown
      const { data: allCasts, error: allError } = await supabase
        .from("farcaster_casts")
        .select("status");

      const statusCounts: Record<string, number> = {};
      if (!allError && allCasts) {
        for (const c of allCasts) {
          const s = c.status || "unknown";
          statusCounts[s] = (statusCounts[s] || 0) + 1;
        }
      }

      // Get recent casts with optional filter
      let query = supabase
        .from("farcaster_casts")
        .select("event_type, event_key, cast_text, status, cast_hash, error, created_at, posted_at")
        .order("created_at", { ascending: false })
        .limit(maxRows);

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: casts, error } = await query;

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching casts: ${error.message}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                statusBreakdown: statusCounts,
                totalCasts: allCasts?.length ?? 0,
                returned: (casts ?? []).length,
                filter: statusFilter || "all",
                casts: (casts ?? []).map((c: any) => ({
                  eventType: c.event_type,
                  eventKey: c.event_key,
                  text: c.cast_text,
                  status: c.status,
                  castHash: c.cast_hash,
                  error: c.error,
                  createdAt: c.created_at,
                  postedAt: c.posted_at,
                })),
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
