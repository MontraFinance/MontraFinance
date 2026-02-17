/**
 * Tool: get_xmtp_conversations
 * List the Montra bot's XMTP conversations with message previews.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Wallet } from "ethers";
import { Client } from "@xmtp/xmtp-js";

let _client: Client | null = null;

async function getBotClient(): Promise<Client> {
  if (_client) return _client;
  const pk = process.env.XMTP_BOT_PRIVATE_KEY;
  if (!pk) throw new Error("Missing XMTP_BOT_PRIVATE_KEY");
  const wallet = new Wallet(pk);
  _client = await Client.create(wallet, { env: "production" });
  return _client;
}

export function registerGetXmtpConversations(server: McpServer) {
  server.tool(
    "get_xmtp_conversations",
    "List all XMTP conversations for the Montra bot with message previews",
    {
      limit: z.number().optional().default(20).describe("Max conversations to return"),
    },
    async ({ limit }) => {
      try {
        const client = await getBotClient();
        const allConvos = await client.conversations.list();

        const results = [];
        const convos = allConvos.slice(0, limit);

        for (const convo of convos) {
          try {
            const messages = await convo.messages({ limit: 1 });
            const lastMsg = messages[0];
            results.push({
              peerAddress: convo.peerAddress,
              lastMessage: lastMsg ? {
                content: String(lastMsg.content).slice(0, 100),
                senderAddress: lastMsg.senderAddress,
                timestamp: lastMsg.sent?.toISOString() || null,
              } : null,
            });
          } catch {
            results.push({
              peerAddress: convo.peerAddress,
              lastMessage: null,
            });
          }
        }

        // Sort by most recent message
        results.sort((a, b) => {
          const ta = a.lastMessage?.timestamp || "";
          const tb = b.lastMessage?.timestamp || "";
          return tb.localeCompare(ta);
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              botAddress: await client.address,
              totalConversations: allConvos.length,
              showing: results.length,
              conversations: results,
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
