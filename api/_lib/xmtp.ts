/**
 * XMTP V3 server-side client for bot messaging
 * Uses @xmtp/agent-sdk Client directly with manual signer.
 *
 * IMPORTANT: Serverless functions lose /tmp on cold starts, creating new
 * "installations" each time. We use disableAutoRegister + revokeAllOtherInstallations
 * to stay under XMTP's 10-installation limit.
 */

let _client: any = null;

function buildSigner(wallet: any, IdentifierKind: any) {
  const address = wallet.address;
  return {
    type: "EOA" as const,
    getIdentifier: () => ({
      identifier: address,
      identifierKind: IdentifierKind.Ethereum,
    }),
    signMessage: async (message: string) => {
      const sig = await wallet.signMessage(message);
      const hex = sig.startsWith("0x") ? sig.slice(2) : sig;
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
      }
      return bytes;
    },
  };
}

function parseEncKey(hex: string): Uint8Array {
  const key = new Uint8Array(32);
  for (let i = 0; i < 64; i += 2) {
    key[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return key;
}

export async function getXmtpClient(): Promise<any> {
  if (_client) return _client;

  const privateKey = process.env.XMTP_BOT_PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing XMTP_BOT_PRIVATE_KEY");

  const encKeyHex = process.env.XMTP_DB_ENCRYPTION_KEY;
  if (!encKeyHex) throw new Error("Missing XMTP_DB_ENCRYPTION_KEY");

  const { Wallet } = await import("ethers");
  const { Client, IdentifierKind, HistorySyncUrls } = await import("@xmtp/agent-sdk");

  const wallet = new Wallet(privateKey);
  const signer = buildSigner(wallet, IdentifierKind);
  const encKey = parseEncKey(encKeyHex);

  const opts = {
    env: "production" as const,
    dbEncryptionKey: encKey,
    dbPath: `/tmp/xmtp-bot-${wallet.address}.db`,
    historySyncUrl: HistorySyncUrls.production,
    disableAutoRegister: false,
  };

  _client = await Client.create(signer, opts);

  // Sync conversations from network
  await _client.conversations.sync();

  return _client;
}

/**
 * Send an XMTP message to a wallet address via the bot
 */
export async function sendXmtpMessage(
  recipientAddress: string,
  text: string,
): Promise<{ sent: boolean; error?: string }> {
  try {
    const client = await getXmtpClient();
    const { IdentifierKind } = await import("@xmtp/agent-sdk");

    const inboxId = await client.fetchInboxIdByIdentifier({
      identifier: recipientAddress,
      identifierKind: IdentifierKind.Ethereum,
    });

    if (!inboxId) {
      return { sent: false, error: "Recipient has not enabled XMTP" };
    }

    const dm = await client.conversations.createDm(inboxId);
    await dm.sendText(text);
    return { sent: true };
  } catch (err: any) {
    return { sent: false, error: err.message };
  }
}

/**
 * Format alert messages for different event types
 */
export function formatAlert(
  alertType: string,
  data: Record<string, any>,
): string {
  switch (alertType) {
    case "trade":
      return `Trade Alert: Agent "${data.agentName || data.agentId}" executed a ${data.side || "swap"} — ${data.sellToken} -> ${data.buyToken}. Amount: ${data.amount || "N/A"}`;
    case "milestone":
      return `Milestone: Agent "${data.agentName || data.agentId}" crossed ${data.milestone || "a new milestone"}! Current P&L: ${data.pnl || "N/A"}`;
    case "burn":
      return `Burn Confirmed: ${data.amount || "?"} $MONTRA burned on Base. TX: ${data.txHash || "pending"}`;
    case "status":
      return `Agent "${data.agentName || data.agentId}" status: ${data.status || "unknown"}. Trades: ${data.trades || 0}, P&L: ${data.pnl || "$0"}`;
    default:
      return `Montra Finance Alert: ${JSON.stringify(data)}`;
  }
}
