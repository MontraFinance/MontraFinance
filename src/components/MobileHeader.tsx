import { useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { isBaseAppWebView } from '@/lib/baseapp';

const MobileHeader = () => {
  const { connected, walletAddress, connect, setShowModal } = useWallet();

  // Auto-connect Coinbase Wallet when inside Base App WebView
  useEffect(() => {
    if (!connected && isBaseAppWebView()) {
      connect('coinbase').catch(() => {});
    }
  }, [connected, connect]);

  const handleConnect = () => {
    // Inside Base App — Coinbase provider is injected, connect directly
    if (isBaseAppWebView()) {
      connect('coinbase').catch(() => {});
    } else {
      // Regular mobile browser — show wallet selection modal
      setShowModal(true);
    }
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-12 bg-background/95 backdrop-blur-sm border-b border-border flex items-center justify-between px-4"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary" />
        <span className="text-xs font-mono font-bold tracking-widest text-foreground">MONTRA</span>
      </div>
      <div className="flex items-center gap-2">
        {connected ? (
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {walletAddress}
          </span>
        ) : (
          <button
            onClick={handleConnect}
            className="text-[10px] font-mono font-bold text-primary border border-primary/30 rounded-lg px-3 py-1"
          >
            CONNECT
          </button>
        )}
      </div>
    </header>
  );
};

export default MobileHeader;
