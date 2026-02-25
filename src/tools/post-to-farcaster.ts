/**
 * Tool: post_to_farcaster
 * Broadcast a message to Farcaster via the Montra account.
 * Uses Neynar API with the platform's signer UUID.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";

export function registerPostToFarcaster(server: McpServer) {
  server.tool(
    "post_to_farcaster",
    "Broadcast a message to Farcaster from the Montra account. Posts market updates, agent milestones, burn events, or custom messages to Warpcast",
    {
      text: z.string().min(1).max(1024).describe("Cast text content (max 1024 chars)"),
      eventType: z
        .enum(["market_update", "agent_milestone", "burn_event", "custom"])
        .optional()
        .default("custom")
        .describe("Type of event being broadcast"),
      eventKey: z.string().optional().describe("Optional event key for deduplication"),
    },
    async ({ text, eventType, eventKey }) => {
      const neynarApiKey = process.env.NEYNAR_API_KEY;
      const signerUuid = process.env.FARCASTER_SIGNER_UUID;

      if (!neynarApiKey || !signerUuid) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Farcaster not configured",
                missing: [
                  !neynarApiKey ? "NEYNAR_API_KEY" : null,
                  !signerUuid ? "FARCASTER_SIGNER_UUID" : null,
                ].filter(Boolean),
              }),
            },
          ],
          isError: true,
        };
      }

      // Check dedup if eventKey provided
      if (eventKey) {
        const supabase = getSupabase();
        const { data: existing } = await supabase
          .from("farcaster_casts")
          .select("id")
          .eq("event_key", eventKey)
          .eq("status", "posted")
          .limit(1);

        if (existing && existing.length > 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  skipped: true,
                  reason: "duplicate_event_key",
                  eventKey,
                  message: "This event was already posted to Farcaster.",
                }),
              },
            ],
          };
        }
      }

      try {
        // Post via Neynar REST API
        const resp = await fetch("https://api.neynar.com/v2/farcaster/cast", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            api_key: neynarApiKey,
          },
          body: JSON.stringify({
            signer_uuid: signerUuid,
            text,
          }),
          signal: AbortSignal.timeout(10000),
        });

        const data = await resp.json();

        if (!resp.ok) {
          // Log failure to DB
          const supabase = getSupabase();
          await supabase.from("farcaster_casts").insert({
            event_type: eventType,
            event_key: eventKey || null,
            cast_text: text,
            status: "failed",
            error: JSON.stringify(data),
          });

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error: data.message || `Neynar returned ${resp.status}`,
                  statusCode: resp.status,
                }),
              },
            ],
            isError: true,
          };
        }

        const castHash = data.cast?.hash || data.hash || null;

        // Log success to DB
        const supabase = getSupabase();
        await supabase.from("farcaster_casts").insert({
          event_type: eventType,
          event_key: eventKey || null,
          cast_text: text,
          status: "posted",
          cast_hash: castHash,
          posted_at: new Date().toISOString(),
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  castHash,
                  text: text.length > 100 ? text.slice(0, 100) + "..." : text,
                  eventType,
                  eventKey: eventKey || null,
                  platform: "Farcaster (Warpcast)",
                  timestamp: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Farcaster post failed: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}
