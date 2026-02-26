import { useWallet } from '@/contexts/WalletContext';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import type { WalletType } from '@/types/wallet';
import phantomLogo from '@/assets/phantom-logo.jpg';
import metamaskLogo from '@/assets/metamask-logo.png';

const wallets: { type: WalletType; name: string; logo: string; desc: string; installUrl: string }[] = [
  {
    type: 'phantom',
    name: 'Phantom',
    logo: phantomLogo,
    desc: 'Multi-chain wallet for Base',
    installUrl: 'https://phantom.app/',
  },
  {
    type: 'metamask',
    name: 'MetaMask',
    logo: metamaskLogo,
    desc: 'The most popular EVM wallet',
    installUrl: 'https://metamask.io/download/',
  },
];

const isInstalled = (type: WalletType): boolean => {
  if (typeof window === 'undefined') return false;
  if (type === 'phantom') return !!window.phantom?.ethereum;
  if (type === 'metamask') return !!window.ethereum?.isMetaMask && !window.ethereum?.isPhantom;
  return false;
};

const WalletModal = () => {
  const { showModal, setShowModal, connect, connecting } = useWallet();

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={() => !connecting && setShowModal(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-base font-bold tracking-tight">Connect Wallet</h3>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">Select a wallet to connect on Base</p>
          </div>
          <button
            onClick={() => !connecting && setShowModal(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Wallet list */}
        <div className="p-4 space-y-2">
          {wallets.map((w) => {
            const installed = isInstalled(w.type);
            return (
              <button
                key={w.type}
                onClick={() => connect(w.type)}
                disabled={connecting}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:bg-secondary hover:border-primary/20 transition-all group disabled:opacity-60"
              >
                <img
                  src={w.logo}
                  alt={w.name}
                  className="w-11 h-11 rounded-xl object-cover ring-1 ring-border group-hover:ring-primary/30 transition"
                />
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{w.name}</span>
                    {installed ? (
                      <span className="text-[9px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                        Detected
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        Install <ExternalLink size={8} />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{w.desc}</p>
                </div>
                {connecting && (
                  <Loader2 size={16} className="animate-spin text-primary" />
                )}
              </button>
            );
          })}
        </div>

        {/* Network badge */}
        <div className="px-5 pb-2">
          <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/5 border border-primary/10">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[10px] font-mono text-primary font-medium">Base Network (ETH)</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-1">
          <p className="text-[10px] font-mono text-muted-foreground text-center leading-relaxed">
            By connecting, you agree to the Terms of Service. Your keys never leave your wallet.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
