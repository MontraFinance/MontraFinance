import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { WalletType, EVMProvider } from '@/types/wallet';

// Base chain constants
const BASE_MAINNET_CHAIN_ID = 8453;
const BASE_MAINNET_HEX = '0x2105';

const isProduction =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'montrafinance.com' ||
    window.location.hostname === 'www.montrafinance.com' ||
    window.location.hostname.endsWith('.vercel.app'));

const TARGET_CHAIN_ID = isProduction ? BASE_MAINNET_CHAIN_ID : BASE_MAINNET_CHAIN_ID;
const TARGET_CHAIN_HEX = BASE_MAINNET_HEX;

type NetworkStatus = 'connected' | 'wrong_network' | 'disconnected';

interface WalletContextType {
  connected: boolean;
  connecting: boolean;
  walletAddress: string | null;
  fullWalletAddress: string | null;
  walletType: WalletType | null;
  networkStatus: NetworkStatus;
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  showModal: boolean;
  setShowModal: (v: boolean) => void;
  getProvider: () => EVMProvider | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
};

const formatAddress = (address: string): string =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

const getPhantomEVMProvider = (): EVMProvider | null => {
  if (typeof window === 'undefined') return null;
  const provider = window.phantom?.ethereum;
  if (provider?.isPhantom) return provider;
  return null;
};

const getMetaMaskProvider = (): EVMProvider | null => {
  if (typeof window === 'undefined') return null;
  const provider = window.ethereum;
  if (provider?.isMetaMask && !provider?.isPhantom) return provider;
  return null;
};

const getProvider = (type: WalletType): EVMProvider | null => {
  if (type === 'phantom') return getPhantomEVMProvider();
  if (type === 'metamask') return getMetaMaskProvider();
  return null;
};

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [fullWalletAddress, setFullWalletAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('disconnected');
  const [showModal, setShowModal] = useState(false);

  const clearWallet = useCallback(() => {
    setConnected(false);
    setWalletAddress(null);
    setFullWalletAddress(null);
    setWalletType(null);
    setNetworkStatus('disconnected');
    localStorage.removeItem('montra_wallet');
  }, []);

  const ensureBaseChain = useCallback(async (provider: EVMProvider): Promise<boolean> => {
    try {
      const currentChainHex = (await provider.request({ method: 'eth_chainId' })) as string;
      const currentChainId = parseInt(currentChainHex, 16);

      if (currentChainId === TARGET_CHAIN_ID) {
        setNetworkStatus('connected');
        return true;
      }

      // Try switching to Base
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: TARGET_CHAIN_HEX }],
        });
        setNetworkStatus('connected');
        return true;
      } catch (switchError: unknown) {
        const err = switchError as { code?: number };
        // Chain not added — add it
        if (err.code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: TARGET_CHAIN_HEX,
                chainName: 'Base',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org'],
              },
            ],
          });
          setNetworkStatus('connected');
          return true;
        }
        console.error('[WalletContext] Failed to switch to Base:', switchError);
        setNetworkStatus('wrong_network');
        return false;
      }
    } catch (err) {
      console.error('[WalletContext] Error checking chain:', err);
      setNetworkStatus('wrong_network');
      return false;
    }
  }, []);

  const connect = useCallback(
    async (type: WalletType) => {
      setConnecting(true);

      try {
        const provider = getProvider(type);

        if (!provider) {
          const urls: Record<WalletType, string> = {
            phantom: 'https://phantom.app/',
            metamask: 'https://metamask.io/download/',
          };
          window.open(urls[type], '_blank');
          setConnecting(false);
          return;
        }

        // Request accounts via EIP-1193
        const accounts = (await provider.request({
          method: 'eth_requestAccounts',
        })) as string[];

        if (accounts.length === 0) {
          setConnecting(false);
          return;
        }

        const address = accounts[0];
        console.log(`[WalletContext] ${type} connected:`, address);

        // Ensure we're on Base
        await ensureBaseChain(provider);

        const formatted = formatAddress(address);
        setWalletType(type);
        setWalletAddress(formatted);
        setFullWalletAddress(address);
        setConnected(true);
        setShowModal(false);

        // Persist
        localStorage.setItem(
          'montra_wallet',
          JSON.stringify({ type, address: formatted, fullAddress: address })
        );
      } catch (err: unknown) {
        const error = err as { code?: number; message?: string };
        // User rejected
        if (error.code === 4001 || error.message?.includes('rejected')) {
          setConnecting(false);
          return;
        }
        console.error('[WalletContext] Connection failed:', err);
        setNetworkStatus('disconnected');
      } finally {
        setConnecting(false);
      }
    },
    [ensureBaseChain]
  );

  const disconnect = useCallback(async () => {
    clearWallet();
  }, [clearWallet]);

  const getProviderForBurn = useCallback((): EVMProvider | null => {
    if (!walletType) return null;
    return getProvider(walletType);
  }, [walletType]);

  // Eager reconnect on mount
  useEffect(() => {
    const saved = localStorage.getItem('montra_wallet');
    if (!saved) return;

    const { type, address, fullAddress } = JSON.parse(saved) as {
      type: WalletType;
      address: string;
      fullAddress: string;
    };

    // Restore state immediately
    setWalletType(type);
    setWalletAddress(address);
    setFullWalletAddress(fullAddress);
    setConnected(true);
    setNetworkStatus('connected');

    // Verify provider still connected
    const eagerReconnect = async () => {
      await new Promise((r) => setTimeout(r, 500));
      const provider = getProvider(type);
      if (!provider) {
        clearWallet();
        return;
      }

      try {
        const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
        if (accounts.length === 0) {
          clearWallet();
          return;
        }

        if (accounts[0].toLowerCase() !== fullAddress.toLowerCase()) {
          clearWallet();
          return;
        }

        await ensureBaseChain(provider);
        console.log(`[WalletContext] ${type} eagerly reconnected:`, accounts[0]);
      } catch {
        clearWallet();
      }
    };

    eagerReconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for account/chain/disconnect events
  useEffect(() => {
    if (!walletType || !fullWalletAddress) return;
    const provider = getProvider(walletType);
    if (!provider) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accts = accounts as string[];
      if (accts.length === 0) {
        clearWallet();
        return;
      }
      if (accts[0].toLowerCase() !== fullWalletAddress.toLowerCase()) {
        clearWallet();
      }
    };

    const handleChainChanged = (newChainHex: unknown) => {
      const chainId = parseInt(newChainHex as string, 16);
      if (chainId !== TARGET_CHAIN_ID) {
        setNetworkStatus('wrong_network');
      } else {
        setNetworkStatus('connected');
      }
    };

    const handleDisconnect = () => {
      clearWallet();
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);
    provider.on('disconnect', handleDisconnect);

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
      provider.removeListener('disconnect', handleDisconnect);
    };
  }, [walletType, fullWalletAddress, clearWallet]);

  return (
    <WalletContext.Provider
      value={{
        connected,
        connecting,
        walletAddress,
        fullWalletAddress,
        walletType,
        networkStatus,
        connect,
        disconnect,
        showModal,
        setShowModal,
        getProvider: getProviderForBurn,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
