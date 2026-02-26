import { Wallet, ChevronDown, LogOut, Copy, Check, Settings } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useState } from 'react';
import SettingsModal from '@/components/SettingsModal';

const ConnectWalletButton = ({ variant = 'default' }: { variant?: 'default' | 'hero' }) => {
  const { connected, walletAddress, fullWalletAddress, walletType, networkStatus, setShowModal, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleCopy = () => {
    if (fullWalletAddress) {
      navigator.clipboard.writeText(fullWalletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (connected && walletAddress) {
    return (
      <>
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 border border-border rounded-lg px-3 py-1.5 text-xs font-mono hover:bg-secondary transition"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${networkStatus === 'connected' ? 'bg-primary' : 'bg-destructive'}`} />
            <span className="text-foreground">{walletAddress}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Base</span>
            <ChevronDown size={12} className="text-muted-foreground" />
          </button>

          {showDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-3 border-b border-border">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">Connected via {walletType} on Base</p>
                  <p className="text-xs font-mono text-foreground mt-1 break-all">{fullWalletAddress}</p>
                </div>
                <div className="p-1.5">
                  <button
                    onClick={handleCopy}
                    className="w-full flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg hover:bg-secondary transition text-muted-foreground hover:text-foreground"
                  >
                    {copied ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy Address'}
                  </button>
                  <button
                    onClick={() => { setShowSettings(true); setShowDropdown(false); }}
                    className="w-full flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg hover:bg-secondary transition text-muted-foreground hover:text-foreground"
                  >
                    <Settings size={12} />
                    Settings
                  </button>
                  <button
                    onClick={() => { disconnect(); setShowDropdown(false); }}
                    className="w-full flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg hover:bg-destructive/10 transition text-destructive"
                  >
                    <LogOut size={12} />
                    Disconnect
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      </>
    );
  }

  return (
    <button
      onClick={() => setShowModal(true)}
      className={`flex items-center gap-2 border border-border rounded-lg px-3 py-1.5 text-xs font-mono hover:bg-secondary hover:border-primary/30 transition-all ${
        variant === 'hero' ? 'bg-background/80 backdrop-blur' : ''
      }`}
    >
      <Wallet size={14} />
      CONNECT WALLET
    </button>
  );
};

export default ConnectWalletButton;
