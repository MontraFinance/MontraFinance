import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Agent, AgentConfig, AgentStats, AgentContextType, PnlDataPoint, DeployResult, ExchangeKey } from '@/types/agent';
import { generateInitialStats, generateInitialPnlHistory } from '@/data/agentMockData';
import { useWallet } from '@/contexts/WalletContext';
import {
  deployAgentAPI,
  listAgentsAPI,
  mapRowToAgent,
  updateStatusAPI,
  deleteAgentAPI,
  fundAgentAPI,
  updateStatsAPI,
  registerAgentAPI,
  confirmFundingAPI,
  activateTradingAPI,
  withdrawFromAgentAPI,
} from '@/services/agentService';
import {
  listExchangeKeysAPI,
  addExchangeKeyAPI,
  deleteExchangeKeyAPI,
} from '@/services/exchangeKeyService';
import { registerAgent as registerAgentERC8004 } from '@/lib/erc8004';
import { useRealtimeAgents } from '@/hooks/useRealtimeAgents';
import { toast } from 'sonner';

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
  const [exchangeKeys, setExchangeKeys] = useState<ExchangeKey[]>([]);
  const [exchangeKeysLoading, setExchangeKeysLoading] = useState(false);
  const statsTimers = useRef<Record<string, number>>({});
  const prevStatusMap = useRef<Map<string, string>>(new Map());

  // Real-time agent updates via Supabase
  const { status: realtimeStatus } = useRealtimeAgents({
    walletAddress: fullWalletAddress,
    onInsert: useCallback((row) => {
      try {
        const agent = mapRowToAgent(row as any);
        setAgents(prev => {
          if (prev.some(a => a.id === agent.id)) {
            return prev.map(a => a.id === agent.id ? agent : a);
          }
          return [...prev, agent];
        });
        prevStatusMap.current.set(agent.id, agent.status);
        toast(`Agent ${agent.config?.name || 'new'} deployed`);
      } catch { /* ignore malformed rows */ }
    }, []),
    onUpdate: useCallback((row) => {
      try {
        const agent = mapRowToAgent(row as any);
        setAgents(cur => cur.map(a => a.id === agent.id ? agent : a));
        const oldStatus = prevStatusMap.current.get(agent.id);
        if (oldStatus && oldStatus !== agent.status) {
          toast(`Agent ${agent.config?.name}: ${oldStatus} → ${agent.status}`);
        }
        prevStatusMap.current.set(agent.id, agent.status);
      } catch { /* ignore malformed rows */ }
    }, []),
    onDelete: useCallback((oldRow) => {
      const id = (oldRow as any)?.id;
      if (id) {
        setAgents(prev => prev.filter(a => a.id !== id));
        prevStatusMap.current.delete(id);
      }
    }, []),
  });

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
        // Seed prevStatusMap for real-time diff detection
        const map = new Map<string, string>();
        remote.forEach(a => map.set(a.id, a.status));
        prevStatusMap.current = map;
        // Clean up localStorage if we successfully loaded from API
        if (remote.length > 0) {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [fullWalletAddress]);

  // Load exchange keys when wallet changes
  useEffect(() => {
    if (!fullWalletAddress) {
      setExchangeKeys([]);
      return;
    }
    let cancelled = false;
    setExchangeKeysLoading(true);
    listExchangeKeysAPI(fullWalletAddress).then(keys => {
      if (!cancelled) setExchangeKeys(keys);
    }).finally(() => {
      if (!cancelled) setExchangeKeysLoading(false);
    });
    return () => { cancelled = true; };
  }, [fullWalletAddress]);

  const refreshExchangeKeys = useCallback(async () => {
    if (!fullWalletAddress) return;
    const keys = await listExchangeKeysAPI(fullWalletAddress);
    setExchangeKeys(keys);
  }, [fullWalletAddress]);

  const addExchangeKey = useCallback(async (
    exchange: string,
    label: string,
    apiKey: string,
    secret: string,
    passphrase?: string,
    permissions?: string[],
  ): Promise<ExchangeKey> => {
    if (!fullWalletAddress) throw new Error('Wallet not connected');
    const key = await addExchangeKeyAPI(fullWalletAddress, exchange, label, apiKey, secret, passphrase, permissions);
    setExchangeKeys(prev => [key, ...prev]);
    return key;
  }, [fullWalletAddress]);

  const deleteExchangeKey = useCallback(async (keyId: string): Promise<void> => {
    if (!fullWalletAddress) throw new Error('Wallet not connected');
    await deleteExchangeKeyAPI(fullWalletAddress, keyId);
    setExchangeKeys(prev => prev.filter(k => k.id !== keyId));
  }, [fullWalletAddress]);

  const deployAgent = useCallback(async (config: AgentConfig, ownerAddress: string): Promise<DeployResult> => {
    const id = crypto.randomUUID();
    const agent: Agent = {
      id,
      config,
      wallet: {
        address: '', // Will be filled by API response
        allocatedBudget: 0, // Budget starts at 0 until funded
        remainingBudget: 0,
        currency: config.budgetCurrency || 'USDC',
      },
      stats: generateInitialStats(),
      status: 'deploying',
      pnlHistory: generateInitialPnlHistory(config.budgetAmount || 0, config.strategyId),
      createdAt: new Date().toISOString(),
      deployedByAddress: ownerAddress,
      erc8004AgentId: null,
      erc8004TxHash: null,
      erc8004RegisteredAt: null,
      apiKeyId: null,
      apiKeyMasked: null,
      agentWalletAddress: null,
      fundingTxHash: null,
      fundingConfirmed: false,
      tradingEnabled: false,
      exchangeKeyId: config.exchangeKeyId || null,
    };

    // Optimistic local update
    setAgents(prev => [...prev, agent]);

    let deployResponse;
    try {
      deployResponse = await deployAgentAPI(ownerAddress, agent);
    } catch {
      // Rollback on failure
      setAgents(prev => prev.filter(a => a.id !== id));
      throw new Error('Failed to deploy agent');
    }

    // Use structured response from deployAgentAPI
    const { agentWalletAddress, apiKeyMasked, apiKeyId } = deployResponse;

    setAgents(prev => prev.map(a =>
      a.id === id
        ? {
            ...a,
            status: 'stopped' as const,
            wallet: { ...a.wallet, address: agentWalletAddress || a.wallet.address },
            agentWalletAddress,
            apiKeyId,
            apiKeyMasked,
          }
        : a,
    ));

    // Attempt on-chain ERC-8004 registration, then set status to deploying (awaiting funding)
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
      }
    })();

    return {
      agent: { ...agent, agentWalletAddress, apiKeyId, apiKeyMasked },
      agentWalletAddress: agentWalletAddress || '',
      apiKey: deployResponse.apiKey || '',
      apiKeyId: apiKeyId || '',
      apiKeyMasked: apiKeyMasked || '',
    };
  }, [fullWalletAddress, getProvider]);

  const pauseAgent = useCallback((id: string) => {
    setAgents(prev => prev.map(a => a.id === id && a.status === 'active' ? { ...a, status: 'paused' } : a));
    if (fullWalletAddress) {
      updateStatusAPI(fullWalletAddress, id, 'paused').catch((err) => console.warn('[AgentContext] API call failed:', err));
    }
  }, [fullWalletAddress]);

  const resumeAgent = useCallback((id: string) => {
    setAgents(prev => prev.map(a => a.id === id && (a.status === 'paused' || a.status === 'stopped') ? { ...a, status: 'active' } : a));
    if (fullWalletAddress) {
      updateStatusAPI(fullWalletAddress, id, 'active').catch((err) => console.warn('[AgentContext] API call failed:', err));
    }
  }, [fullWalletAddress]);

  const stopAgent = useCallback((id: string) => {
    setAgents(prev => prev.map(a =>
      a.id === id && (a.status === 'active' || a.status === 'paused' || a.status === 'deploying')
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

  const confirmAgentFunding = useCallback(async (agentId: string, txHash: string, amount: number): Promise<void> => {
    if (!fullWalletAddress) throw new Error('Wallet not connected');
    await confirmFundingAPI(fullWalletAddress, agentId, txHash, amount);
    setAgents(prev => prev.map(a => {
      if (a.id !== agentId) return a;
      return {
        ...a,
        fundingTxHash: txHash,
        fundingConfirmed: true,
        wallet: {
          ...a.wallet,
          allocatedBudget: a.wallet.allocatedBudget + amount,
          remainingBudget: a.wallet.remainingBudget + amount,
        },
      };
    }));
  }, [fullWalletAddress]);

  const activateTrading = useCallback(async (agentId: string): Promise<void> => {
    if (!fullWalletAddress) throw new Error('Wallet not connected');
    await activateTradingAPI(fullWalletAddress, agentId);
    setAgents(prev => prev.map(a =>
      a.id === agentId
        ? { ...a, tradingEnabled: true, status: 'active' }
        : a,
    ));
  }, [fullWalletAddress]);

  const withdrawFromAgent = useCallback(async (agentId: string, amount: number): Promise<string> => {
    if (!fullWalletAddress) throw new Error('Wallet not connected');
    const txHash = await withdrawFromAgentAPI(fullWalletAddress, agentId, amount);
    setAgents(prev => prev.map(a => {
      if (a.id !== agentId) return a;
      return {
        ...a,
        wallet: {
          ...a.wallet,
          remainingBudget: Math.max(0, a.wallet.remainingBudget - amount),
        },
      };
    }));
    return txHash;
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
      realtimeStatus,
      exchangeKeys,
      exchangeKeysLoading,
      deployAgent,
      pauseAgent,
      resumeAgent,
      stopAgent,
      deleteAgent,
      fundAgent,
      updateAgentStats,
      getAgent,
      registerAgentOnChain,
      confirmAgentFunding,
      activateTrading,
      withdrawFromAgent,
      addExchangeKey,
      deleteExchangeKey,
      refreshExchangeKeys,
    }}>
      {children}
    </AgentContext.Provider>
  );
}
