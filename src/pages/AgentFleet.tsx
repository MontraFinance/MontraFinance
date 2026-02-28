import { useState, useEffect } from 'react';
import { Bot, Plus, Brain } from 'lucide-react';
import LaunchCountdown from '@/components/LaunchCountdown';
import { motion } from 'framer-motion';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import TierBadge from '@/components/TierBadge';
import { useAgents } from '@/contexts/AgentContext';
import { useWallet } from '@/contexts/WalletContext';
import { useAgentSimulation } from '@/hooks/useAgentSimulation';
import type { Strategy } from '@/types/agent';
import AgentOverviewStats from '@/components/agents/AgentOverviewStats';
import AgentCard from '@/components/agents/AgentCard';
import AgentDeployModal from '@/components/agents/AgentDeployModal';
import StrategyMarketplace from '@/components/agents/StrategyMarketplace';
import SmartDeployModal from '@/components/agents/SmartDeployModal';
import { AppSidebar } from '@/components/AppSidebar';
import { Skeleton } from '@/components/ui/skeleton';

type Tab = 'fleet' | 'deploy' | 'strategies';

const AgentFleet = () => {
  const { agents, loading } = useAgents();
  const { connected, fullWalletAddress } = useWallet();
  const [activeTab, setActiveTab] = useState<Tab>('fleet');
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [prefillStrategy, setPrefillStrategy] = useState<Strategy | null>(null);
  const [showSmartDeploy, setShowSmartDeploy] = useState(false);
  const [portfolioValue, setPortfolioValue] = useState(0);

  // Activate simulation for active agents
  useAgentSimulation();

  // Fetch portfolio value for Smart Deploy
  useEffect(() => {
    if (!connected || !fullWalletAddress) return;
    fetch(`/api/portfolio?wallet=${encodeURIComponent(fullWalletAddress)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setPortfolioValue(res.totalValueUsd);
      })
      .catch((err) => console.warn('Portfolio fetch failed:', err));
  }, [connected, fullWalletAddress]);

  const handleDeployFromStrategy = (strategy: Strategy) => {
    setPrefillStrategy(strategy);
    setShowDeployModal(true);
  };

  const handleDeployNew = () => {
    setPrefillStrategy(null);
    setShowDeployModal(true);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'fleet', label: 'FLEET' },
    { id: 'deploy', label: 'DEPLOY' },
    { id: 'strategies', label: 'STRATEGIES' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LaunchCountdown title="Agent Fleet" />
      {/* Top bar */}
      <header className="border-b border-border px-3 md:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-xs md:text-sm font-mono font-bold tracking-wider">AGENT FLEET</h1>
          <span className="text-[10px] md:text-xs font-mono text-primary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {agents.filter(a => a.status === 'active').length} ACTIVE
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
            {new Date().toLocaleString()}
          </span>
          <TierBadge />
          <ConnectWalletButton />
        </div>
      </header>

      <div className="flex">
        <AppSidebar activePage="agents" />

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-6">
          {/* Tab bar */}
          <div className="flex flex-wrap items-center gap-1 mb-6 border-b border-border pb-3">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-[10px] md:text-xs font-mono font-bold px-3 md:px-4 py-1.5 rounded-lg transition ${
                  activeTab === tab.id
                    ? 'text-primary-foreground bg-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <div className="flex items-center gap-1.5 ml-auto">
              {connected && portfolioValue > 0 && (
                <button
                  onClick={() => setShowSmartDeploy(true)}
                  className="flex items-center gap-1 text-[10px] md:text-xs font-mono text-purple-600 border border-purple-300 rounded-lg px-2 md:px-3 py-1.5 hover:bg-purple-50 transition"
                >
                  <Brain size={12} /> <span className="hidden sm:inline">Smart</span> Deploy
                </button>
              )}
              <button
                onClick={handleDeployNew}
                className="flex items-center gap-1 text-[10px] md:text-xs font-mono text-primary border border-primary/30 rounded-lg px-2 md:px-3 py-1.5 hover:bg-primary/10 transition"
              >
                <Plus size={12} /> <span className="hidden sm:inline">New</span> Agent
              </button>
            </div>
          </div>

          {/* Fleet Tab */}
          {activeTab === 'fleet' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              {loading ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}
                  </div>
                </div>
              ) : agents.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-12 text-center">
                  <Bot size={40} className="text-muted-foreground/30 mx-auto mb-4" />
                  <h2 className="text-sm font-mono font-bold text-foreground mb-2">FLEET EMPTY</h2>
                  <p className="text-[10px] font-mono text-muted-foreground mb-6">
                    No autonomous agents deployed. Deploy your first agent to begin automated trading.
                  </p>
                  <button
                    onClick={handleDeployNew}
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2.5 hover:bg-primary/80 transition"
                  >
                    <Plus size={14} /> DEPLOY YOUR FIRST AGENT
                  </button>
                </div>
              ) : (
                <>
                  <AgentOverviewStats agents={agents} />
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                      Active Fleet
                    </span>
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {agents.length} agents
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {agents.map(agent => (
                      <AgentCard key={agent.id} agent={agent} />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Deploy Tab */}
          {activeTab === 'deploy' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              {!connected ? (
                <div className="bg-card border border-border rounded-2xl p-12 text-center">
                  <Bot size={40} className="text-muted-foreground/30 mx-auto mb-4" />
                  <h2 className="text-sm font-mono font-bold text-foreground mb-2">WALLET REQUIRED</h2>
                  <p className="text-[10px] font-mono text-muted-foreground mb-6">
                    Connect your wallet to deploy autonomous trading agents.
                  </p>
                  <ConnectWalletButton />
                </div>
              ) : (
                <div className="max-w-lg">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                      Deploy New Agent
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl p-6">
                    <p className="text-[10px] font-mono text-muted-foreground mb-4">
                      Configure and deploy an autonomous trading agent. Click the button below to open the deployment form.
                    </p>
                    <button
                      onClick={handleDeployNew}
                      className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2.5 hover:bg-primary/80 transition"
                    >
                      <Plus size={14} /> CONFIGURE & DEPLOY
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Strategies Tab */}
          {activeTab === 'strategies' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <StrategyMarketplace onDeploy={handleDeployFromStrategy} />
            </motion.div>
          )}
        </main>
      </div>

      {/* Deploy Modal */}
      <AgentDeployModal
        open={showDeployModal}
        onClose={() => { setShowDeployModal(false); setPrefillStrategy(null); }}
        prefillStrategy={prefillStrategy}
      />

      {/* Smart Deploy Modal */}
      <SmartDeployModal
        open={showSmartDeploy}
        onClose={() => setShowSmartDeploy(false)}
        walletAddress={fullWalletAddress || ''}
        portfolioValue={portfolioValue}
      />

    </div>
  );
};

export default AgentFleet;
