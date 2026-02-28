import { Wallet, ChevronDown, LogOut, Copy, Check, Settings } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useState } from 'react';
import SettingsModal from '@/components/SettingsModal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const ConnectWalletButton = ({ variant = 'default' }: { variant?: 'default' | 'hero' }) => {
  const { connected, walletAddress, fullWalletAddress, walletType, networkStatus, basename, avatarUrl, setShowModal, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1.5 sm:gap-2 border border-border rounded-lg px-2 sm:px-3 py-1.5 text-xs font-mono hover:bg-secondary transition max-w-[160px] sm:max-w-none outline-none"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${networkStatus === 'connected' ? 'bg-primary' : 'bg-destructive'}`} />
              )}
              <span className="text-foreground truncate">{basename || walletAddress}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0 hidden sm:inline">Base</span>
              <ChevronDown size={12} className="text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 bg-card border-border rounded-xl shadow-xl">
            <DropdownMenuLabel className="p-3 font-normal">
              {basename && (
                <p className="text-sm font-mono font-semibold text-foreground mb-1">{basename}</p>
              )}
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">Connected via {walletType} on Base</p>
              <p className="text-xs font-mono text-foreground mt-1 break-all">{fullWalletAddress}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleCopy}
              className="flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
            >
              {copied ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy Address'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <Settings size={12} />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={disconnect}
              className="flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg cursor-pointer text-destructive hover:text-destructive focus:text-destructive"
            >
              <LogOut size={12} />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
      <span className="hidden sm:inline">CONNECT WALLET</span>
      <span className="sm:hidden">CONNECT</span>
    </button>
  );
};

export default ConnectWalletButton;
