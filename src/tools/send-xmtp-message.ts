/**
 * Tool: send_xmtp_message
 * Send a message to any XMTP-enabled wallet via the Montra bot.
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

export function registerSendXmtpMessage(server: McpServer) {
  server.tool(
    "send_xmtp_message",
    "Send an XMTP message to any wallet address via the Montra bot",
    {
      recipientAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Recipient wallet address"),
      message: z.string().min(1).max(2000).describe("Message text to send"),
    },
    async ({ recipientAddress, message }) => {
      try {
        const client = await getBotClient();

        const canMessage = await client.canMessage(recipientAddress);
        if (!canMessage) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                sent: false,
                error: "Recipient has not enabled XMTP messaging",
                recipientAddress,
                hint: "The recipient needs to activate XMTP on their wallet first",
              }, null, 2),
            }],
          };
        }

        const conversation = await client.conversations.newConversation(recipientAddress);
        await conversation.send(message);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              sent: true,
              recipientAddress,
              messageLength: message.length,
              timestamp: new Date().toISOString(),
              botAddress: (await client.address),
            }, null, 2),
          }],
        };
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ sent: false, error: err.message }, null, 2),
          }],
        };
      }
    }
  );
}
