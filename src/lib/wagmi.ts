/**
 * Wagmi configuration for OnchainKit integration.
 * Uses injected + Coinbase Wallet connectors on Base mainnet.
 */
import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'Montra Finance' }),
  ],
  transports: {
    [base.id]: http(),
  },
});
