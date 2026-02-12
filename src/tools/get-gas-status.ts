import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

let rpcId = 1000; // offset from other rpc.ts counter

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(BASE_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    signal: AbortSignal.timeout(5000),
  });
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`RPC: ${json.error.message}`);
  return json.result;
}

export function registerGetGasStatus(server: McpServer) {
  server.tool(
    "get_gas_status",
    "Check Base chain network status: current gas price, latest block, and estimated transaction costs in USD",
    {},
    async () => {
      try {
        const [gasPriceHex, blockHex, ethPriceData] = await Promise.all([
          rpcCall("eth_gasPrice", []) as Promise<string>,
          rpcCall("eth_blockNumber", []) as Promise<string>,
          // Fetch ETH price for USD conversion
          fetch("https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006", {
            signal: AbortSignal.timeout(5000),
          }).then((r) => r.json()).catch(() => null),
        ]);

        const gasPriceWei = Number(BigInt(gasPriceHex));
        const gasPriceGwei = gasPriceWei / 1e9;
        const blockNumber = Number(BigInt(blockHex));

        // Get ETH price
        let ethPriceUsd = 0;
        if (ethPriceData?.pairs) {
          const basePairs = ethPriceData.pairs.filter((p: any) => p.chainId === "base");
          const sorted = basePairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
          ethPriceUsd = sorted.length > 0 ? parseFloat(sorted[0].priceUsd) || 0 : 0;
        }

        // Estimate costs for common operations
        const estimates = {
          transfer: { gas: 21_000, label: "ETH transfer" },
          erc20Transfer: { gas: 65_000, label: "ERC-20 transfer" },
          swap: { gas: 150_000, label: "DEX swap" },
          agentDeploy: { gas: 250_000, label: "Agent deploy (approx)" },
        };

        const costEstimates: Record<string, { gasUnits: number; costEth: string; costUsd: string }> = {};
        for (const [key, est] of Object.entries(estimates)) {
          const costEth = (gasPriceWei * est.gas) / 1e18;
          costEstimates[key] = {
            gasUnits: est.gas,
            costEth: costEth.toFixed(8),
            costUsd: ethPriceUsd > 0 ? `$${(costEth * ethPriceUsd).toFixed(4)}` : "N/A",
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  chain: "base",
                  rpcUrl: BASE_RPC_URL,
                  latestBlock: blockNumber,
                  gasPrice: {
                    wei: gasPriceWei,
                    gwei: Math.round(gasPriceGwei * 1000) / 1000,
                  },
                  ethPriceUsd: ethPriceUsd > 0 ? ethPriceUsd : "unavailable",
                  costEstimates,
                  status: gasPriceGwei < 0.01 ? "ultra-low" :
                          gasPriceGwei < 0.1 ? "low" :
                          gasPriceGwei < 1 ? "normal" :
                          gasPriceGwei < 10 ? "elevated" : "congested",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to check gas status: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}
