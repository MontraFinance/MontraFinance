import { Bot, TrendingUp, Wallet } from 'lucide-react';
import type { Agent } from '@/types/agent';

const AgentOverviewStats = ({ agents }: { agents: Agent[] }) => {
  const active = agents.filter(a => a.status === 'active').length;
  const paused = agents.filter(a => a.status === 'paused').length;
  const stopped = agents.filter(a => a.status === 'stopped').length;
  const totalPnl = agents.reduce((sum, a) => sum + a.stats.pnlUsd, 0);
  const totalAllocated = agents.reduce((sum, a) => sum + a.wallet.allocatedBudget, 0);
  const totalRemaining = agents.reduce((sum, a) => sum + a.wallet.remainingBudget, 0);
  const utilization = totalAllocated > 0 ? ((totalAllocated - totalRemaining) / totalAllocated) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bot size={14} className="text-primary" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Fleet Status</span>
        </div>
        <p className="text-2xl font-mono font-bold text-primary mb-2">{agents.length}</p>
        <div className="flex gap-3 text-[10px] font-mono text-muted-foreground">
          <span className="text-primary">{active} active</span>
          <span className="text-yellow-500">{paused} paused</span>
          <span>{stopped} stopped</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-primary" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Total P&L</span>
        </div>
        <p className={`text-2xl font-mono font-bold ${totalPnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
          {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
        </p>
        <p className="text-[10px] font-mono text-muted-foreground mt-1">
          Across {agents.filter(a => a.stats.tradeCount > 0).length} trading agents
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet size={14} className="text-primary" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Capital Deployed</span>
        </div>
        <p className="text-2xl font-mono font-bold text-foreground">${totalAllocated.toLocaleString()}</p>
        <div className="mt-2">
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
            <span>Utilization</span>
            <span>{utilization.toFixed(1)}%</span>
          </div>
          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${utilization}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentOverviewStats;
