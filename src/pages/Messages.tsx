import { useSearchParams, useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import LaunchCountdown from '@/components/LaunchCountdown';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import TierBadge from '@/components/TierBadge';
import { useWallet } from '@/contexts/WalletContext';
import { BotChat } from '@/components/BotChat';
import { AppSidebar } from '@/components/AppSidebar';

const Messages = () => {
  const { connected, fullWalletAddress } = useWallet();
  const [searchParams] = useSearchParams();
  const agentId = searchParams.get('agent');
  const agentName = searchParams.get('name');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LaunchCountdown title="Messages" />
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-mono font-bold tracking-wider">MESSAGES</h1>
          <span className="text-xs font-mono text-primary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            BOT
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
            {new Date().toLocaleString()}
          </span>
          <TierBadge />
          <ConnectWalletButton />
        </div>
      </header>

      <div className="flex">
        <AppSidebar activePage="messages" />

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto">
          {!connected ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <MessageSquare size={40} className="text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-sm font-mono font-bold text-foreground mb-2">WALLET REQUIRED</h2>
              <p className="text-[10px] font-mono text-muted-foreground mb-6">
                Connect your wallet to chat with the Montra Bot.
              </p>
              <ConnectWalletButton />
            </div>
          ) : (
            <BotChat
              walletAddress={fullWalletAddress || ''}
              agentId={agentId}
              agentName={agentName}
              onBack={agentId ? () => navigate('/agents') : undefined}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default Messages;
