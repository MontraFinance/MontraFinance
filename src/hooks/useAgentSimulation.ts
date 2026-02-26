import { useEffect } from 'react';
import { useAgents } from '@/contexts/AgentContext';
import { MOCK_STRATEGIES } from '@/data/agentMockData';

export function useAgentSimulation() {
  const { agents, updateAgentStats } = useAgents();

  useEffect(() => {
    const interval = setInterval(() => {
      agents
        .filter(a => a.status === 'active')
        .forEach(agent => {
          const strategy = MOCK_STRATEGIES.find(s => s.id === agent.config.strategyId);
          const winChance = (strategy?.backtestStats.winRate || 55) / 100;
          const tradeHappens = Math.random() < 0.15;

          if (tradeHappens) {
            const won = Math.random() < winChance;
            const pnlDelta = won
              ? agent.wallet.allocatedBudget * (Math.random() * 0.015 + 0.003)
              : -agent.wallet.allocatedBudget * (Math.random() * 0.012 + 0.002);

            const newPnlUsd = agent.stats.pnlUsd + pnlDelta;
            const newPnlPct = (newPnlUsd / agent.wallet.allocatedBudget) * 100;
            const newTradeCount = agent.stats.tradeCount + 1;
            const oldWins = Math.round(agent.stats.winRate * agent.stats.tradeCount / 100);
            const newWins = won ? oldWins + 1 : oldWins;
            const newWinRate = (newWins / newTradeCount) * 100;

            updateAgentStats(agent.id, {
              pnlUsd: Math.round(newPnlUsd * 100) / 100,
              pnlPct: Math.round(newPnlPct * 100) / 100,
              tradeCount: newTradeCount,
              winRate: Math.round(newWinRate * 10) / 10,
              uptimeSeconds: agent.stats.uptimeSeconds + 5,
              lastTradeAt: new Date().toISOString(),
            }, { timestamp: Date.now(), pnl: Math.round(newPnlUsd * 100) / 100 });
          } else {
            updateAgentStats(agent.id, {
              uptimeSeconds: agent.stats.uptimeSeconds + 5,
            });
          }
        });
    }, 5000);

    return () => clearInterval(interval);
  }, [agents, updateAgentStats]);
}
