/**
 * OnchainKit Swap widget for Base chain token swapping.
 * Uses Coinbase's swap infrastructure (DEX aggregator).
 * Auto-syncs with the existing WalletContext connection.
 */
import { useEffect } from 'react';
import { Swap, SwapAmountInput, SwapButton, SwapMessage, SwapToggleButton } from '@coinbase/onchainkit/swap';
import type { Token } from '@coinbase/onchainkit/token';
import { useAccount, useConnect } from 'wagmi';
import { useWallet } from '@/contexts/WalletContext';

// Base chain tokens — icons from ethereum-lists/tokens (GitHub raw CDN)
const ETH: Token = {
  name: 'Ethereum',
  address: '',
  symbol: 'ETH',
  decimals: 18,
  image: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  chainId: 8453,
};

const USDC: Token = {
  name: 'USD Coin',
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  symbol: 'USDC',
  decimals: 6,
  image: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  chainId: 8453,
};

const WETH: Token = {
  name: 'Wrapped Ether',
  address: '0x4200000000000000000000000000000000000006',
  symbol: 'WETH',
  decimals: 18,
  image: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  chainId: 8453,
};

interface OnchainSwapProps {
  className?: string;
}

export default function OnchainSwap({ className = '' }: OnchainSwapProps) {
  const { connected, walletType } = useWallet();
  const { isConnected: wagmiConnected } = useAccount();
  const { connect, connectors } = useConnect();

  // Bridge: sync existing WalletContext connection to wagmi
  useEffect(() => {
    if (connected && !wagmiConnected && connectors.length > 0) {
      // Find the injected connector (matches whatever wallet the user connected via WalletContext)
      const injectedConnector = connectors.find(c => c.id === 'injected');
      if (injectedConnector) {
        connect({ connector: injectedConnector });
      }
    }
  }, [connected, wagmiConnected, connectors, connect]);

  if (!connected) {
    return (
      <div className={`bg-card border border-border rounded-2xl p-6 text-center ${className}`}>
        <p className="text-sm text-muted-foreground font-mono">Connect your wallet to swap tokens on Base</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Swap
        from={[ETH, USDC, WETH]}
        to={[USDC, ETH, WETH]}
        className="w-full"
      />
    </div>
  );
}
