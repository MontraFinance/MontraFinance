/**
 * Tool: get_whale_transfers
 * Detect large $MONTRA token transfers on Base chain.
 * Queries recent Transfer events from the token contract.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const BASE_RPC = () => process.env.BASE_RPC_URL || "https://mainnet.base.org";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dead";

async function rpcCall(method: string, params: any[]): Promise<any> {
  const res = await fetch(BASE_RPC(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  const json = await res.json();
  return json.result;
}

export function registerGetWhaleTransfers(server: McpServer) {
  server.tool(
    "get_whale_transfers",
    "Detect large $MONTRA token transfers on Base chain — whale movements, burns, and accumulation patterns",
    {
      minTokens: z.number().optional().default(10000000)
        .describe("Minimum token amount to qualify as whale transfer (default: 10M)"),
      blocks: z.number().optional().default(1000)
        .describe("Number of recent blocks to scan (default: 1000, ~30 min)"),
    },
    async ({ minTokens, blocks }) => {
      try {
        const tokenAddress = process.env.BURN_TOKEN_ADDRESS;
        if (!tokenAddress) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: "BURN_TOKEN_ADDRESS not configured" }, null, 2),
            }],
          };
        }

        const latestBlock = await rpcCall("eth_blockNumber", []);
        const fromBlock = "0x" + (parseInt(latestBlock, 16) - blocks).toString(16);

        // Query Transfer events
        const logs = await rpcCall("eth_getLogs", [{
          address: tokenAddress,
          topics: [TRANSFER_TOPIC],
          fromBlock,
          toBlock: "latest",
        }]);

        if (!logs || !Array.isArray(logs)) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                transfers: [],
                totalFound: 0,
                blocksScanned: blocks,
                note: "No transfer events found in the scanned range",
              }, null, 2),
            }],
          };
        }

        // Parse transfer events
        const decimals = parseInt(process.env.BURN_TOKEN_DECIMALS || "18");
        const transfers = logs
          .map((log: any) => {
            const from = "0x" + (log.topics[1] || "").slice(26);
            const to = "0x" + (log.topics[2] || "").slice(26);
            const rawAmount = BigInt(log.data || "0x0");
            const amount = Number(rawAmount) / Math.pow(10, decimals);

            return {
              from,
              to,
              amount,
              txHash: log.transactionHash,
              blockNumber: parseInt(log.blockNumber, 16),
              isBurn: to.toLowerCase() === DEAD_ADDRESS,
              type: to.toLowerCase() === DEAD_ADDRESS ? "BURN" : "TRANSFER",
            };
          })
          .filter((t: any) => t.amount >= minTokens)
          .sort((a: any, b: any) => b.amount - a.amount);

        const burns = transfers.filter((t: any) => t.isBurn);
        const regularTransfers = transfers.filter((t: any) => !t.isBurn);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              blocksScanned: blocks,
              minTokenThreshold: minTokens,
              totalWhaleTransfers: transfers.length,
              totalBurns: burns.length,
              totalBurnedAmount: burns.reduce((sum: number, t: any) => sum + t.amount, 0),
              transfers: transfers.slice(0, 20).map((t: any) => ({
                type: t.type,
                from: t.from,
                to: t.to,
                amount: Math.round(t.amount).toLocaleString(),
                txHash: t.txHash,
                block: t.blockNumber,
              })),
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
