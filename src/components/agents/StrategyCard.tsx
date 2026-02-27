import { Rocket } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Strategy } from '@/types/agent';

const riskColors: Record<string, string> = {
  low: 'text-emerald-500 bg-emerald-500/10',
  medium: 'text-yellow-500 bg-yellow-500/10',
  high: 'text-red-500 bg-red-500/10',
};

const StrategyCard = ({ strategy, onDeploy }: { strategy: Strategy; onDeploy: (s: Strategy) => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-card border border-border rounded-2xl p-4 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-mono font-bold text-foreground">{strategy.name}</h3>
        <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${riskColors[strategy.riskLevel]}`}>
          {strategy.riskLevel}
        </span>
      </div>

      {/* Description */}
      <p className="text-[10px] font-mono text-muted-foreground mb-3 leading-relaxed">
        {strategy.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {strategy.tags.map(tag => (
          <span key={tag} className="text-[10px] font-mono text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
            {tag}
          </span>
        ))}
      </div>

      {/* Backtest Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-[10px] font-mono text-muted-foreground">
        <div>
          <p className="mb-0.5">WIN RATE</p>
          <p className="text-sm font-bold text-primary">{strategy.backtestStats.winRate}%</p>
        </div>
        <div>
          <p className="mb-0.5">AVG RETURN</p>
          <p className="text-sm font-bold text-primary">+{strategy.backtestStats.avgReturn}%</p>
        </div>
        <div>
          <p className="mb-0.5">SHARPE RATIO</p>
          <p className="text-sm font-bold text-foreground">{strategy.backtestStats.sharpeRatio}</p>
        </div>
        <div>
          <p className="mb-0.5">MAX DRAWDOWN</p>
          <p className="text-sm font-bold text-destructive">-{strategy.backtestStats.maxDrawdown}%</p>
        </div>
      </div>

      <p className="text-[10px] font-mono text-muted-foreground/60 mb-4">
        {strategy.backtestStats.totalTrades.toLocaleString()} backtested trades
      </p>

      {/* Deploy Button */}
      <button
        onClick={() => onDeploy(strategy)}
        className="mt-auto flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-3 py-2.5 hover:bg-primary/80 transition"
      >
        <Rocket size={14} /> DEPLOY AS AGENT
      </button>
    </motion.div>
  );
};

export default StrategyCard;
