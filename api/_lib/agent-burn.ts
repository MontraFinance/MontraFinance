/**
 * Server-side MONTRA token burn from an agent's wallet.
 * Follows the exact pattern from handleWithdraw in api/agents/[action].ts:
 * decrypt key → ethers.Wallet + JsonRpcProvider → ERC-20 transfer to dead address.
 */
import { ethers } from "ethers";
import { decryptAgentKey } from "./agent-wallet.js";

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

function getMontraTokenAddress(): string {
  const addr = process.env.BURN_TOKEN_ADDRESS;
  if (!addr) throw new Error("BURN_TOKEN_ADDRESS env var is not set");
  return addr;
}

function getMontraDecimals(): number {
  return parseInt(process.env.BURN_TOKEN_DECIMALS || "18", 10);
}

function getProvider(): ethers.providers.JsonRpcProvider {
  const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";
  return new ethers.providers.JsonRpcProvider(rpcUrl, { name: "base", chainId: 8453 });
}

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

/**
 * Check MONTRA token balance for an agent wallet address.
 * Returns human-readable amount.
 */
export async function checkAgentMontraBalance(agentWalletAddress: string): Promise<number> {
  const provider = getProvider();
  const tokenAddr = getMontraTokenAddress();
  const decimals = getMontraDecimals();
  const contract = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
  const balance = await contract.balanceOf(agentWalletAddress);
  return parseFloat(ethers.utils.formatUnits(balance, decimals));
}

/**
 * Execute a MONTRA token burn from an agent's wallet.
 * Burns tokens by transferring them to the dead address (0x...dEaD).
 *
 * @param encryptedKey - AES-256-GCM encrypted private key from DB
 * @param tokenAmount  - Number of whole tokens to burn
 * @returns txHash of the confirmed burn transaction
 */
export async function executeAgentBurn(
  encryptedKey: string,
  tokenAmount: number,
): Promise<{ txHash: string }> {
  const provider = getProvider();
  const tokenAddr = getMontraTokenAddress();
  const decimals = getMontraDecimals();

  // Decrypt and create wallet
  const privateKey = decryptAgentKey(encryptedKey);
  const wallet = new ethers.Wallet(privateKey, provider);
  const realAddress = wallet.address;

  const contract = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);

  // Check MONTRA balance
  const rawAmount = ethers.utils.parseUnits(tokenAmount.toString(), decimals);
  const balance = await contract.balanceOf(realAddress);

  if (rawAmount.gt(balance)) {
    const balanceHuman = parseFloat(ethers.utils.formatUnits(balance, decimals));
    throw new Error(
      `INSUFFICIENT_MONTRA: Agent has ${balanceHuman.toFixed(2)} MONTRA, needs ${tokenAmount}`,
    );
  }

  // Check ETH for gas
  const ethBalance = await provider.getBalance(realAddress);
  const estimatedGas = await contract.estimateGas
    .transfer(DEAD_ADDRESS, rawAmount)
    .catch(() => ethers.BigNumber.from(60000));
  const gasPrice = await provider.getGasPrice();
  const gasCost = estimatedGas.mul(gasPrice);

  if (ethBalance.lt(gasCost)) {
    const ethNeeded = parseFloat(ethers.utils.formatEther(gasCost));
    const ethHave = parseFloat(ethers.utils.formatEther(ethBalance));
    throw new Error(
      `INSUFFICIENT_GAS: Agent has ${ethHave.toFixed(6)} ETH, needs ~${ethNeeded.toFixed(6)} ETH for burn tx`,
    );
  }

  // Execute burn (transfer to dead address)
  const tx = await contract.transfer(DEAD_ADDRESS, rawAmount, {
    gasLimit: estimatedGas.add(10000),
  });

  // Wait for 1-block confirmation
  const receipt = await tx.wait(1);
  if (receipt.status !== 1) {
    throw new Error("Burn transaction reverted on-chain");
  }

  return { txHash: receipt.transactionHash };
}
