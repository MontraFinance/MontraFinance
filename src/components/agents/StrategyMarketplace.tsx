import { MOCK_STRATEGIES } from '@/data/agentMockData';
import type { Strategy } from '@/types/agent';
import StrategyCard from './StrategyCard';

const StrategyMarketplace = ({ onDeploy }: { onDeploy: (s: Strategy) => void }) => {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
          Strategy Marketplace
        </span>
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-mono text-muted-foreground">
          {MOCK_STRATEGIES.length} strategies
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {MOCK_STRATEGIES.map(strategy => (
          <StrategyCard key={strategy.id} strategy={strategy} onDeploy={onDeploy} />
        ))}
      </div>
    </div>
  );
};

export default StrategyMarketplace;
