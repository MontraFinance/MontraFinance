import { X, Copy, Check, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Switch } from '@/components/ui/switch';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const SettingsModal = ({ open, onClose }: SettingsModalProps) => {
  const { fullWalletAddress, walletType } = useWallet();
  const { theme, toggleTheme } = useTheme();
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleCopy = () => {
    if (fullWalletAddress) {
      navigator.clipboard.writeText(fullWalletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground tracking-wide uppercase">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary transition text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Public Key Section */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-2">
              Public Key {walletType && `(${walletType})`}
            </p>
            <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-lg p-3">
              <p className="text-xs font-mono text-foreground break-all flex-1">
                {fullWalletAddress || 'Not connected'}
              </p>
              {fullWalletAddress && (
                <button
                  onClick={handleCopy}
                  className="shrink-0 p-1.5 rounded-md hover:bg-secondary transition text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                </button>
              )}
            </div>
          </div>

          {/* Accessibility Section */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-3">
              Accessibility
            </p>
            <div className="flex items-center justify-between bg-secondary/50 border border-border rounded-lg p-3">
              <div className="flex items-center gap-2">
                {theme === 'light' ? (
                  <Sun size={14} className="text-muted-foreground" />
                ) : (
                  <Moon size={14} className="text-muted-foreground" />
                )}
                <span className="text-xs font-mono text-foreground">
                  {theme === 'light' ? 'Light Mode' : 'Dark Mode'}
                </span>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
