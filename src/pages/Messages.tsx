import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Bell, Bot, Activity, Brain, Loader2, Users, User, Send } from 'lucide-react';
import LaunchCountdown from '@/components/LaunchCountdown';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import TierBadge from '@/components/TierBadge';
import { useWallet } from '@/contexts/WalletContext';
import { useTier } from '@/contexts/TierContext';
import { BotChat } from '@/components/BotChat';
import { HoldersChat } from '@/components/HoldersChat';
import TelegramSettings from '@/components/TelegramSettings';
import { AppSidebar } from '@/components/AppSidebar';

interface Alert {
  id: string;
  type: 'trade' | 'checkin';
  agentName: string;
  title: string;
  description: string;
  status: string;
  timestamp: string;
}

type Tab = 'chat' | 'holders' | 'alerts' | 'telegram';

const STATUS_ICONS: Record<string, string> = {
  filled: '\u2705',
  submitted: '\u{1F4E4}',
  cancelled: '\u274C',
  buy: '\u{1F4C8}',
  sell: '\u{1F4C9}',
  hold: '\u23F8\uFE0F',
};

const STATUS_COLORS: Record<string, string> = {
  filled: 'border-green-500/30 bg-green-500/5',
  submitted: 'border-blue-500/30 bg-blue-500/5',
  cancelled: 'border-red-500/30 bg-red-500/5',
  buy: 'border-green-500/30 bg-green-500/5',
  sell: 'border-red-500/30 bg-red-500/5',
  hold: 'border-yellow-500/30 bg-yellow-500/5',
};

const Messages = () => {
  const { connected, fullWalletAddress } = useWallet();
  const { tier, balance, loading: tierLoading } = useTier();
  const [searchParams] = useSearchParams();
  const agentId = searchParams.get('agent');
  const agentName = searchParams.get('name');
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Display name state
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [displayNameLoading, setDisplayNameLoading] = useState(false);

  // Ping count for notification badge
  const [pingCount, setPingCount] = useState(0);

  // Fetch display name
  useEffect(() => {
    if (!connected || !fullWalletAddress) {
      setDisplayName(null);
      return;
    }
    setDisplayNameLoading(true);
    fetch(`/api/holders/profile?wallet=${encodeURIComponent(fullWalletAddress)}`)
      .then((r) => r.json())
      .then((data) => {
        setDisplayName(data.profile?.displayName || null);
      })
      .catch(() => {})
      .finally(() => setDisplayNameLoading(false));
  }, [connected, fullWalletAddress]);

  // Fetch unread pings
  const fetchPings = useCallback(async () => {
    if (!fullWalletAddress) return;
    try {
      const resp = await fetch(`/api/holders/pings?wallet=${encodeURIComponent(fullWalletAddress)}`);
      const data = await resp.json();
      setPingCount(data.unread || 0);
    } catch {
      // non-critical
    }
  }, [fullWalletAddress]);

  // Poll pings every 10 seconds
  useEffect(() => {
    if (!connected || !fullWalletAddress) return;
    fetchPings();
    const interval = setInterval(fetchPings, 10000);
    return () => clearInterval(interval);
  }, [connected, fullWalletAddress, fetchPings]);

  // Mark pings as read when switching to holders tab
  useEffect(() => {
    if (activeTab === 'holders' && connected && fullWalletAddress && pingCount > 0) {
      fetch('/api/holders/pings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: fullWalletAddress }),
      })
        .then(() => setPingCount(0))
        .catch(() => {});
    }
  }, [activeTab, connected, fullWalletAddress, pingCount]);

  const fetchAlerts = useCallback(async () => {
    if (!fullWalletAddress) return;
    setAlertsLoading(true);
    try {
      const resp = await fetch(`/api/bot/alerts?wallet=${encodeURIComponent(fullWalletAddress)}`);
      const data = await resp.json();
      if (data.alerts) setAlerts(data.alerts);
    } catch {
      // non-critical
    } finally {
      setAlertsLoading(false);
    }
  }, [fullWalletAddress]);

  useEffect(() => {
    if (activeTab === 'alerts' && connected && fullWalletAddress) {
      fetchAlerts();
    }
  }, [activeTab, connected, fullWalletAddress, fetchAlerts]);

  const tabs: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
    { id: 'chat', label: 'CHAT', icon: MessageSquare },
    { id: 'holders', label: 'HOLDERS', icon: Users },
    { id: 'alerts', label: 'ALERTS', icon: Bell },
    { id: 'telegram', label: 'TELEGRAM', icon: Send },
  ];

  function timeAgo(ts: string): string {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LaunchCountdown title="Messages" />
      {/* Top bar */}
      <header className="border-b border-border px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-mono font-bold tracking-wider">MESSAGES</h1>
          <span className="text-xs font-mono text-primary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {activeTab === 'chat' ? 'BOT' : activeTab === 'holders' ? 'GROUP' : 'ACTIVITY'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Display name in header (Messages page only) */}
          {connected && displayName && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-foreground bg-secondary/50 rounded-lg px-2.5 py-1">
              <User size={10} className="text-primary" />
              {displayName}
            </span>
          )}
          <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
            {new Date().toLocaleString()}
          </span>
          <TierBadge />
          <ConnectWalletButton />
        </div>
      </header>

      <div className="flex">
        <AppSidebar activePage="messages" pingCount={pingCount} />

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-6 max-w-4xl mx-auto">
          {!connected ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <MessageSquare size={40} className="text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-sm font-mono font-bold text-foreground mb-2">WALLET REQUIRED</h2>
              <p className="text-[10px] font-mono text-muted-foreground mb-6">
                Connect your wallet to chat with the Montra Bot and view alerts.
              </p>
              <ConnectWalletButton />
            </div>
          ) : (
            <>
              {/* Tab bar */}
              <div className="flex items-center gap-1 mb-4 border-b border-border pb-3">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const badge = tab.id === 'alerts' && alerts.length > 0
                    ? alerts.length
                    : tab.id === 'holders' && pingCount > 0
                      ? pingCount
                      : 0;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 text-xs font-mono font-bold px-4 py-1.5 rounded-lg transition ${
                        activeTab === tab.id
                          ? 'text-primary-foreground bg-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                    >
                      <Icon size={12} />
                      {tab.label}
                      {badge > 0 && (
                        <span className={`ml-1 text-[9px] rounded-full px-1.5 py-0.5 ${
                          tab.id === 'holders'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-primary/20 text-primary'
                        }`}>
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Chat Tab */}
              {activeTab === 'chat' && (
                <BotChat
                  walletAddress={fullWalletAddress || ''}
                  agentId={agentId}
                  agentName={agentName}
                  onBack={agentId ? () => navigate('/agents') : undefined}
                />
              )}

              {/* Holders Tab */}
              {activeTab === 'holders' && (
                <HoldersChat
                  walletAddress={fullWalletAddress || ''}
                  tier={tier}
                  balance={balance}
                  tierLoading={tierLoading}
                  displayName={displayName}
                  onDisplayNameCreated={(name) => setDisplayName(name)}
                  onDisplayNameDismissed={() => setActiveTab('chat')}
                />
              )}

              {/* Alerts Tab */}
              {activeTab === 'alerts' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                      Agent Activity Feed
                    </span>
                    <div className="h-px flex-1 bg-border" />
                    <button
                      onClick={fetchAlerts}
                      disabled={alertsLoading}
                      className="text-[10px] font-mono text-muted-foreground hover:text-primary transition disabled:opacity-50"
                    >
                      {alertsLoading ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>

                  {alertsLoading && alerts.length === 0 ? (
                    <div className="py-12 text-center">
                      <Loader2 size={20} className="animate-spin mx-auto text-muted-foreground mb-2" />
                      <p className="text-[10px] font-mono text-muted-foreground">Loading alerts...</p>
                    </div>
                  ) : alerts.length === 0 ? (
                    <div className="bg-card border border-border rounded-2xl p-8 text-center">
                      <Bell size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-xs font-mono text-muted-foreground mb-1">No alerts yet</p>
                      <p className="text-[10px] font-mono text-muted-foreground/70 max-w-sm mx-auto">
                        Agent activity alerts will appear here when your agents execute trades or complete AI check-ins.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {alerts.map((alert) => {
                        const icon = alert.type === 'trade'
                          ? STATUS_ICONS[alert.status] || '\u{1F4CA}'
                          : STATUS_ICONS[alert.status] || '\u{1F9E0}';
                        const colorClass = STATUS_COLORS[alert.status] || 'border-border bg-card';

                        return (
                          <div
                            key={alert.id}
                            className={`border rounded-xl p-3 transition hover:bg-secondary/30 ${colorClass}`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-lg mt-0.5">{icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-mono font-bold text-foreground truncate">
                                    {alert.title}
                                  </p>
                                  <span className="text-[9px] font-mono text-muted-foreground whitespace-nowrap">
                                    {timeAgo(alert.timestamp)}
                                  </span>
                                </div>
                                <p className="text-[10px] font-mono text-primary mt-0.5">{alert.agentName}</p>
                                <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">
                                  {alert.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Telegram Tab */}
              {activeTab === 'telegram' && (
                <TelegramSettings walletAddress={fullWalletAddress || ''} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Messages;
