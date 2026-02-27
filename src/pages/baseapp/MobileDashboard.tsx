import { useRef } from 'react';
import { Cpu, Database, Signal, Zap, Activity, Clock } from 'lucide-react';
import MobileLayout from '@/components/MobileLayout';
import CommandCenter from '@/components/CommandCenter';
import type { CommandCenterHandle } from '@/components/CommandCenter';
import SentimentWidget from '@/components/SentimentWidget';
import { useWallet } from '@/contexts/WalletContext';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { useTelemetry } from '@/hooks/useTelemetry';
import { GPU_CONFIG } from '@/config/platform';

const ACTION_QUERIES: Record<string, string> = {
  'Market': 'Give me a full market analysis on BTC right now.',
  'Risk': 'What are the biggest risks in the crypto market right now?',
  'Signals': 'What trading signals are firing right now?',
  'Portfolio': 'I have a $10K portfolio split between BTC and ETH. Should I rebalance?',
};

const StatChip = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="bg-card border border-border rounded-xl px-3 py-2 min-w-[110px] flex-shrink-0">
    <p className="text-[8px] font-mono text-muted-foreground uppercase">{label}</p>
    <p className={`text-sm font-mono font-bold ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
  </div>
);

const MobileDashboard = () => {
  const terminalRef = useRef<CommandCenterHandle>(null);
  const { connected } = useWallet();
  const t = useTelemetry(2000);

  return (
    <MobileLayout>
      {!connected ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center mt-4">
          <Zap size={32} className="text-muted-foreground/30 mx-auto mb-3" />
          <h2 className="text-sm font-mono font-bold mb-2">CONNECT WALLET</h2>
          <p className="text-[10px] font-mono text-muted-foreground mb-4">
            Connect your wallet to access the terminal.
          </p>
          <ConnectWalletButton />
        </div>
      ) : (
        <div className="space-y-3 py-3">
          {/* Terminal */}
          <CommandCenter ref={terminalRef} />

          {/* Quick action chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {Object.entries(ACTION_QUERIES).map(([label, query]) => (
              <button
                key={label}
                onClick={() => terminalRef.current?.submitQuery(query)}
                className="text-[10px] font-mono text-muted-foreground border border-border rounded-lg px-3 py-1.5 whitespace-nowrap hover:text-foreground hover:bg-secondary transition flex-shrink-0"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Stats row — horizontal scroll */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <StatChip label="GPU CLUSTER" value={`${t.gpuUtil}%`} accent />
            <StatChip label="DB LATENCY" value={`${t.dbLatency}ms`} />
            <StatChip label="SIGNAL" value={`${t.sigAccuracy}%`} accent />
            <StatChip label="THROUGHPUT" value={`${t.currentThroughput}ms`} />
            <StatChip label="TASKS" value={t.totalTasks.toLocaleString()} />
          </div>

          {/* Quick stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Cpu size={10} className="text-primary" />
                <span className="text-[8px] font-mono text-muted-foreground uppercase">CPU</span>
              </div>
              <p className="text-lg font-mono font-bold text-primary">{t.cpuUtil}%</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Database size={10} className="text-primary" />
                <span className="text-[8px] font-mono text-muted-foreground uppercase">DB</span>
              </div>
              <p className="text-lg font-mono font-bold">{t.dbUptime}%</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity size={10} className="text-primary" />
                <span className="text-[8px] font-mono text-muted-foreground uppercase">Active</span>
              </div>
              <p className="text-lg font-mono font-bold">{t.activeTasks}</p>
            </div>
          </div>

          {/* Sentiment widget */}
          <SentimentWidget />
        </div>
      )}
    </MobileLayout>
  );
};

export default MobileDashboard;
