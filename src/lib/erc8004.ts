/**
 * ERC-8004 Trustless Agents — contract interaction helpers.
 * Uses ethers v5 for ABI encoding. All transactions target Base chain only.
 */
import { ethers } from 'ethers';
import type { EVMProvider } from '@/types/wallet';

// ── Contract Addresses (Base Mainnet — canonical singletons) ──

export const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
export const REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63';
export const BASE_CHAIN_ID = 8453;
export const BASE_CHAIN_HEX = '0x2105';
export const AGENT_REGISTRY_STRING = `eip155:${BASE_CHAIN_ID}:${IDENTITY_REGISTRY}`;

// ── ABI Fragments (human-readable, ethers v5) ──

const IDENTITY_ABI = [
  'function register(string agentURI, tuple(string metadataKey, bytes metadataValue)[] metadata) returns (uint256 agentId)',
  'function register(string agentURI) returns (uint256 agentId)',
  'function register() returns (uint256 agentId)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getMetadata(uint256 agentId, string metadataKey) view returns (bytes)',
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
];

const REPUTATION_ABI = [
  'function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)',
  'function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)',
  'function getClients(uint256 agentId) view returns (address[])',
  'event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, int128 value, uint8 valueDecimals, string indexed indexedTag1, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)',
];

const identityIface = new ethers.utils.Interface(IDENTITY_ABI);
const reputationIface = new ethers.utils.Interface(REPUTATION_ABI);

// ── Helpers ──

function getBaseProvider(): ethers.providers.JsonRpcProvider {
  return new ethers.providers.JsonRpcProvider('https://mainnet.base.org', BASE_CHAIN_ID);
}

/**
 * Ensure the wallet is on Base. Switches if needed, then polls eth_chainId
 * up to 10 times to confirm the switch actually took effect.
 * Throws if the wallet refuses to switch.
 */
async function ensureOnBase(provider: EVMProvider): Promise<void> {
  const getChain = async () => parseInt((await provider.request({ method: 'eth_chainId' })) as string, 16);

  let chainId = await getChain();
  console.log(`[ERC-8004] Current chainId: ${chainId}`);

  if (chainId === BASE_CHAIN_ID) return;

  // Request switch
  console.log('[ERC-8004] Switching to Base...');
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_HEX }],
    });
  } catch (switchErr: unknown) {
    const err = switchErr as { code?: number };
    if (err.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: BASE_CHAIN_HEX,
          chainName: 'Base',
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://mainnet.base.org'],
          blockExplorerUrls: ['https://basescan.org'],
        }],
      });
    } else {
      throw new Error(
        'Could not switch to Base network. Please switch manually in your wallet and try again.',
      );
    }
  }

  // Poll to confirm the switch actually happened (some wallets are async)
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    chainId = await getChain();
    console.log(`[ERC-8004] Post-switch poll ${i + 1}: chainId=${chainId}`);
    if (chainId === BASE_CHAIN_ID) {
      console.log('[ERC-8004] ✓ Confirmed on Base');
      return;
    }
  }

  throw new Error(
    `Wallet is still on chain ${chainId} after switching. ` +
    'Please MANUALLY switch to Base in your wallet and try again.',
  );
}

/**
 * Send a transaction on Base chain.
 * Uses ethers Web3Provider wrapping the wallet, configured for Base chainId.
 * The Web3Provider sends eth_sendTransaction through the wallet but ethers
 * attaches the correct chainId context.
 */
async function sendTx(
  evmProvider: EVMProvider,
  to: string,
  data: string,
): Promise<ethers.providers.TransactionReceipt> {
  // First ensure wallet is actually on Base
  await ensureOnBase(evmProvider);

  // Create Web3Provider with explicit Base network — this tells ethers
  // to expect chainId 8453 and include it in the transaction context
  const web3Provider = new ethers.providers.Web3Provider(
    evmProvider as ethers.providers.ExternalProvider,
    { chainId: BASE_CHAIN_ID, name: 'base' },
  );
  const signer = web3Provider.getSigner();
  const from = await signer.getAddress();
  console.log(`[ERC-8004] Sending tx via ethers Web3Provider (Base): from=${from} to=${to}`);

  // Send transaction through ethers — it will use eth_sendTransaction
  // but with the provider configured for Base
  const txResponse = await signer.sendTransaction({
    to,
    data,
    value: 0,
  });
  console.log(`[ERC-8004] Tx submitted: ${txResponse.hash}`);

  // Wait for confirmation on Base RPC (independent of wallet provider)
  const baseProvider = getBaseProvider();
  const receipt = await baseProvider.waitForTransaction(txResponse.hash, 1, 120_000);
  if (!receipt) throw new Error('Transaction not confirmed on Base within 2 minutes');
  console.log(`[ERC-8004] ✓ Tx confirmed on Base, block=${receipt.blockNumber}`);
  return receipt;
}

// ── Identity Registry ──

export async function registerAgent(
  evmProvider: EVMProvider,
  agentURI: string,
  metadata?: { metadataKey: string; metadataValue: string }[],
): Promise<{ agentId: number; txHash: string }> {
  let data: string;

  if (metadata && metadata.length > 0) {
    const entries = metadata.map((m) => [
      m.metadataKey,
      ethers.utils.toUtf8Bytes(m.metadataValue),
    ]);
    data = identityIface.encodeFunctionData('register(string,(string,bytes)[])', [agentURI, entries]);
  } else {
    data = identityIface.encodeFunctionData('register(string)', [agentURI]);
  }

  const receipt = await sendTx(evmProvider, IDENTITY_REGISTRY, data);

  // Parse Registered event to extract the minted agentId (tokenId)
  for (const log of receipt.logs) {
    try {
      const parsed = identityIface.parseLog(log);
      if (parsed.name === 'Registered') {
        return {
          agentId: parsed.args.agentId.toNumber(),
          txHash: receipt.transactionHash,
        };
      }
    } catch {
      // not our event, skip
    }
  }

  throw new Error('Registration event not found in transaction receipt');
}

// ── Reputation Registry ──

export async function giveFeedback(
  evmProvider: EVMProvider,
  agentId: number,
  value: number,
  valueDecimals: number = 0,
  tag1: string = 'quality',
  tag2: string = '',
  endpoint: string = 'https://montrafinance.com/agents',
  feedbackURI: string = '',
  feedbackHash: string = ethers.constants.HashZero,
): Promise<string> {
  const data = reputationIface.encodeFunctionData('giveFeedback', [
    agentId,
    value,
    valueDecimals,
    tag1,
    tag2,
    endpoint,
    feedbackURI,
    feedbackHash,
  ]);

  const receipt = await sendTx(evmProvider, REPUTATION_REGISTRY, data);
  return receipt.transactionHash;
}

export async function getReputationSummary(
  agentId: number,
): Promise<{ count: number; summaryValue: number; summaryValueDecimals: number }> {
  const provider = getBaseProvider();
  const contract = new ethers.Contract(REPUTATION_REGISTRY, REPUTATION_ABI, provider);

  let clients: string[];
  try {
    clients = await contract.getClients(agentId);
  } catch {
    return { count: 0, summaryValue: 0, summaryValueDecimals: 0 };
  }

  if (clients.length === 0) {
    return { count: 0, summaryValue: 0, summaryValueDecimals: 0 };
  }

  const [count, summaryValue, summaryValueDecimals] = await contract.getSummary(
    agentId,
    clients,
    'quality',
    '',
  );

  return {
    count: Number(count),
    summaryValue: Number(summaryValue),
    summaryValueDecimals: Number(summaryValueDecimals),
  };
}
