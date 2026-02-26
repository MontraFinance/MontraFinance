import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Agent, AgentConfig, AgentStats, AgentContextType, PnlDataPoint } from '@/types/agent';
import { deriveAgentWalletAddress, generateInitialStats, generateInitialPnlHistory } from '@/data/agentMockData';
import { useWallet } from '@/contexts/WalletContext';
import {
  deployAgentAPI,
  listAgentsAPI,
  updateStatusAPI,
  deleteAgentAPI,
  fundAgentAPI,
  updateStatsAPI,
  registerAgentAPI,
} from '@/services/agentService';
import { registerAgent as registerAgentERC8004 } from '@/lib/erc8004';

const STORAGE_KEY = 'montra_agents';
const STATS_DEBOUNCE_MS = 30_000;

const AgentContext = createContext<AgentContextType | null>(null);

export function useAgents() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgents must be used within AgentProvider');
  return ctx;
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const { fullWalletAddress, getProvider } = useWallet();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const statsTimers = useRef<Record<string, number>>({});

  // Load agents from API when wallet changes
  useEffect(() => {
    if (!fullWalletAddress) {
      setAgents([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const remote = await listAgentsAPI(fullWalletAddress);

      if (cancelled) return;

      // One-time localStorage migration
      if (remote.length === 0) {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const local: Agent[] = JSON.parse(stored);
            const mine = local.filter(
              a => a.deployedByAddress.toLowerCase() === fullWalletAddress.toLowerCase()
            );
            if (mine.length > 0) {
              // Push local agents to API
              for (const agent of mine) {
                try {
                  await deployAgentAPI(fullWalletAddress, agent);
                } catch {
                  // best-effort migration
                }
              }
              // Re-fetch to get canonical rows
              const migrated = await listAgentsAPI(fullWalletAddress);
              if (!cancelled) {
                setAgents(migrated.length > 0 ? migrated : mine);
                localStorage.removeItem(STORAGE_KEY);
              }
              setLoading(false);
              return;
            }
          }
        } catch {
          // ignore corrupt localStorage
        }
      }

      if (!cancelled) {
        setAgents(remote);
        // Clean up localStorage if we successfully loaded from API
        if (remote.length > 0) {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [fullWalletAddress]);

  const deployAgent = useCallback(async (config: AgentConfig, ownerAddress: string): Promise<Agent> => {
    const id = crypto.randomUUID();
    const agent: Agent = {
      id,
      config,
      wallet: {
        address: deriveAgentWalletAddress(id),
        allocatedBudget: config.budgetAmount,
        remainingBudget: config.budgetAmount,
        currency: config.budgetCurrency,
      },
      stats: generateInitialStats(),
      status: 'deploying',
      pnlHistory: generateInitialPnlHistory(config.budgetAmount, config.strategyId),
      createdAt: new Date().toISOString(),
      deployedByAddress: ownerAddress,
      erc8004AgentId: null,
      erc8004TxHash: null,
      erc8004RegisteredAt: null,
    };

    // Optimistic local update
    setAgents(prev => [...prev, agent]);

    try {
      await deployAgentAPI(ownerAddress, agent);
    } catch {
      // Rollback on failure
      setAgents(prev => prev.filter(a => a.id !== id));
      throw new Error('Failed to deploy agent');
    }

    // Attempt on-chain ERC-8004 registration, then activate
    (async () => {
      try {
        const provider = getProvider();
        if (provider && fullWalletAddress) {
          const agentURI = `https://montrafinance.com/api/agents/metadata/${id}`;
          const { agentId: erc8004Id, txHash } = await registerAgentERC8004(
            provider,
            agentURI,
            [{ metadataKey: 'platform', metadataValue: 'Montra Finance' }],
          );
          await registerAgentAPI(fullWalletAddress, id, erc8004Id, txHash);
          setAgents(prev => prev.map(a =>
            a.id === id
              ? { ...a, erc8004AgentId: erc8004Id, erc8004TxHash: txHash, erc8004RegisteredAt: new Date().toISOString() }
              : a,
          ));
        }
      } catch (err) {
        console.warn('[AgentContext] On-chain ERC-8004 registration failed (non-fatal):', err);
      } finally {
        setAgents(prev => prev.map(a => a.id === id ? { ...a, status: 'active' } : a));
        if (fullWalletAddress) {
          updateStatusAPI(fullWalletAddress, id, 'active').catch((err) => console.warn('[AgentContext] API call failed:', err));
        }
      }
    })();

    return agent;
  }, [fullWalletAddress, getProvider]);

  const pauseAgent = useCallback((id: string) => {
    setAgents(prev => prev.map(a => a.id === id && a.status === 'active' ? { ...a, status: 'paused' } : a));
    if (fullWalletAddress) {
      updateStatusAPI(fullWalletAddress, id, 'paused').catch((err) => console.warn('[AgentContext] API call failed:', err));
    }
  }, [fullWalletAddress]);

  const resumeAgent = useCallback((id: string) => {
    setAgents(prev => prev.map(a => a.id === id && a.status === 'paused' ? { ...a, status: 'active' } : a));
    if (fullWalletAddress) {
      updateStatusAPI(fullWalletAddress, id, 'active').catch((err) => console.warn('[AgentContext] API call failed:', err));
    }
  }, [fullWalletAddress]);

  const stopAgent = useCallback((id: string) => {
    setAgents(prev => prev.map(a =>
      a.id === id && (a.status === 'active' || a.status === 'paused')
        ? { ...a, status: 'stopped' }
        : a
    ));
    if (fullWalletAddress) {
      updateStatusAPI(fullWalletAddress, id, 'stopped').catch((err) => console.warn('[AgentContext] API call failed:', err));
    }
  }, [fullWalletAddress]);

  const deleteAgent = useCallback((id: string) => {
    setAgents(prev => prev.filter(a => a.id !== id));
    if (fullWalletAddress) {
      deleteAgentAPI(fullWalletAddress, id).catch((err) => console.warn('[AgentContext] API call failed:', err));
    }
  }, [fullWalletAddress]);

  const fundAgent = useCallback((id: string, amount: number) => {
    setAgents(prev => prev.map(a => {
      if (a.id !== id) return a;
      return {
        ...a,
        wallet: {
          ...a.wallet,
          allocatedBudget: a.wallet.allocatedBudget + amount,
          remainingBudget: a.wallet.remainingBudget + amount,
        },
      };
    }));
    if (fullWalletAddress) {
      fundAgentAPI(fullWalletAddress, id, amount).catch((err) => console.warn('[AgentContext] API call failed:', err));
    }
  }, [fullWalletAddress]);

  const updateAgentStats = useCallback((id: string, stats: Partial<AgentStats>, pnlPoint?: PnlDataPoint) => {
    // Always update local state immediately
    setAgents(prev => prev.map(a => {
      if (a.id !== id) return a;
      const newStats = { ...a.stats, ...stats };
      const newHistory = pnlPoint
        ? [...a.pnlHistory.slice(-47), pnlPoint]
        : a.pnlHistory;
      return { ...a, stats: newStats, pnlHistory: newHistory };
    }));

    // Debounce API calls per agent (30s)
    if (fullWalletAddress) {
      const now = Date.now();
      const lastCall = statsTimers.current[id] || 0;
      if (now - lastCall > STATS_DEBOUNCE_MS) {
        statsTimers.current[id] = now;
        updateStatsAPI(fullWalletAddress, id, stats, pnlPoint).catch((err) => console.warn('[AgentContext] API call failed:', err));
      }
    }
  }, [fullWalletAddress]);

  const getAgent = useCallback((id: string): Agent | undefined => {
    return agents.find(a => a.id === id);
  }, [agents]);

  const registerAgentOnChain = useCallback(async (agentId: string): Promise<{ erc8004AgentId: number; txHash: string }> => {
    if (!fullWalletAddress) throw new Error('Wallet not connected');
    const provider = getProvider();
    if (!provider) throw new Error('No wallet provider');

    const agentURI = `https://montrafinance.com/api/agents/metadata/${agentId}`;
    const { agentId: erc8004Id, txHash } = await registerAgentERC8004(
      provider,
      agentURI,
      [{ metadataKey: 'platform', metadataValue: 'Montra Finance' }],
    );

    await registerAgentAPI(fullWalletAddress, agentId, erc8004Id, txHash);

    setAgents(prev => prev.map(a =>
      a.id === agentId
        ? { ...a, erc8004AgentId: erc8004Id, erc8004TxHash: txHash, erc8004RegisteredAt: new Date().toISOString() }
        : a,
    ));

    return { erc8004AgentId: erc8004Id, txHash };
  }, [fullWalletAddress, getProvider]);

  return (
    <AgentContext.Provider value={{
      agents,
      loading,
      deployAgent,
      pauseAgent,
      resumeAgent,
      stopAgent,
      deleteAgent,
      fundAgent,
      updateAgentStats,
      getAgent,
      registerAgentOnChain,
    }}>
      {children}
    </AgentContext.Provider>
  );
}
