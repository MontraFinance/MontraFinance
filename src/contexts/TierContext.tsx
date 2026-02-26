import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import type { TierId, TierStatus } from '@/types/tier';
import { getTierDef } from '@/types/tier';

interface TierContextType {
  tier: TierId;
  balance: number;
  nextTier: TierId | null;
  tokensToNext: number;
  burnDiscount: number;
  maxAgents: number;
  perks: string[];
  loading: boolean;
  configured: boolean;
  refresh: () => void;
}

const DEFAULT: TierContextType = {
  tier: 'none',
  balance: 0,
  nextTier: 'bronze',
  tokensToNext: 100_000_000,
  burnDiscount: 0,
  maxAgents: 3,
  perks: [],
  loading: false,
  configured: false,
  refresh: () => {},
};

const TierContext = createContext<TierContextType>(DEFAULT);

export function useTier() {
  return useContext(TierContext);
}

export function TierProvider({ children }: { children: React.ReactNode }) {
  const { connected, fullWalletAddress } = useWallet();
  const [state, setState] = useState<Omit<TierContextType, 'refresh' | 'loading'>>({
    tier: 'none',
    balance: 0,
    nextTier: 'bronze',
    tokensToNext: 100_000_000,
    burnDiscount: 0,
    maxAgents: 3,
    perks: [],
    configured: false,
  });
  const [loading, setLoading] = useState(false);

  const fetchTier = useCallback(async () => {
    if (!connected || !fullWalletAddress) {
      setState({
        tier: 'none',
        balance: 0,
        nextTier: 'bronze',
        tokensToNext: 100_000_000,
        burnDiscount: 0,
        maxAgents: 3,
        perks: [],
        configured: false,
      });
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`/api/tiers/check?wallet=${encodeURIComponent(fullWalletAddress)}`);
      const data = await resp.json();

      if (data.success) {
        setState({
          tier: data.tier as TierId,
          balance: data.balance,
          nextTier: data.nextTier as TierId | null,
          tokensToNext: data.tokensToNext,
          burnDiscount: data.burnDiscount,
          maxAgents: data.maxAgents,
          perks: data.perks,
          configured: data.configured,
        });
      }
    } catch {
      // Silently fail — tier is a nice-to-have, not critical
    } finally {
      setLoading(false);
    }
  }, [connected, fullWalletAddress]);

  useEffect(() => {
    fetchTier();
  }, [fetchTier]);

  return (
    <TierContext.Provider value={{ ...state, loading, refresh: fetchTier }}>
      {children}
    </TierContext.Provider>
  );
}
