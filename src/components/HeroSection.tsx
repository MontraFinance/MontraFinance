import { ArrowRight, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import ConnectWalletButton from './ConnectWalletButton';

const CA = '0x5bdc2d52adf52e7c510e17a79310a45d80d14b07';

function CaButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(CA);
    setCopied(true);
    toast.success('Contract address copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 bg-secondary/80 border border-border rounded-lg px-3 py-2 hover:bg-secondary hover:border-primary/30 transition-all cursor-pointer group"
    >
      <span className="text-xs font-mono font-bold text-primary">CA:</span>
      <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors truncate">
        {CA}
      </span>
      {copied ? (
        <Check size={12} className="text-green-500 shrink-0" />
      ) : (
        <Copy size={12} className="text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
      )}
    </button>
  );
}

const HeroSection = () => {
  return (
    <header className="relative w-full h-screen flex flex-col justify-between p-6 sm:p-12 z-10 pointer-events-none">
      {/* Top Nav */}
      <div className="flex justify-between items-start pointer-events-auto w-full max-w-[1400px] mx-auto">
        <div className="text-lg font-bold tracking-tight text-primary">Montra Finance</div>
        <div className="flex items-center gap-6">
          <nav className="hidden sm:flex gap-8 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <a href="#about" className="hover:text-primary transition-colors">About</a>
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#tokenomics" className="hover:text-primary transition-colors">Tokenomics</a>
            <a href="/docs" className="hover:text-primary transition-colors">Developer Docs</a>
          </nav>
          <ConnectWalletButton variant="hero" />
        </div>
      </div>

      {/* Hero Content */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-12 pointer-events-auto w-full max-w-[1400px] mx-auto mb-4">
        {/* Left Info */}
        <div className="max-w-md space-y-8">
          <CaButton />
          <p className="text-sm leading-relaxed text-muted-foreground font-medium">
            Unleash the power of AI-driven quantitative analysis and real-time market insights on the Base blockchain. Your edge in decentralized finance starts here.
          </p>
          <div className="flex gap-6">
            <a href="/dashboard" className="group flex items-center gap-2 text-xs font-bold tracking-widest uppercase border-b border-primary pb-1 text-primary hover:text-primary/70 hover:border-primary/70 transition-all cursor-pointer">
              Launch Terminal <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform duration-300" />
            </a>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="group flex items-center gap-2 text-xs font-bold tracking-widest uppercase border-b border-transparent pb-1 text-muted-foreground hover:text-primary hover:border-primary transition-all cursor-pointer"
            >
              Explore Features
            </button>
          </div>
        </div>

        {/* Right Title */}
        <div className="text-right">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tighter leading-[0.85] text-primary">
            <span className="block">Institutional AI</span>
            <span className="block">Trading Intelligence</span>
          </h1>
          <p className="text-2xl md:text-4xl text-muted-foreground font-normal mt-3 tracking-tight">Built on Base</p>
        </div>
      </div>
    </header>
  );
};

export default HeroSection;
