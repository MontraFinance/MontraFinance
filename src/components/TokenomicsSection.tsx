import { ShieldCheck } from 'lucide-react';

const TokenomicsSection = () => {
  return (
    <section id="tokenomics" className="bg-surface-elevated border-t border-border px-6 sm:px-8">
      <div className="max-w-6xl mx-auto py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Tokenomics */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest font-mono">Tokenomics</span>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-primary mb-6">The $MONTRA Token</h2>
            <p className="text-muted-foreground font-mono mb-8 text-sm leading-relaxed">
              $MONTRA is the native ERC-20 utility token of the Montra Finance ecosystem on Base. It fuels the platform and fosters a sustainable, deflationary economic model.
            </p>

            <div className="space-y-6">
              <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                <h4 className="font-bold text-primary mb-2 text-sm uppercase tracking-wide">Utility</h4>
                <ul className="text-sm text-muted-foreground space-y-2 font-mono">
                  {['Terminal Access & Premium Features', 'Marketplace Transaction Fees', 'Future Governance Rights'].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <div className="w-1 h-1 bg-muted-foreground rounded-full mt-2" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                <h4 className="font-bold text-primary mb-2 text-sm uppercase tracking-wide">Deflationary Mechanism</h4>
                <p className="text-sm text-muted-foreground font-mono leading-relaxed">
                  10% of all profits from the strategy marketplace are used for a continuous buyback and burn program, reducing supply and aligning token value with platform success.
                </p>
              </div>
            </div>
          </div>

          {/* Technology */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest font-mono">Architecture</span>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-primary mb-6">Cutting-Edge Tech Stack</h2>
            <p className="text-muted-foreground font-mono mb-8 text-sm leading-relaxed">
              Engineered with a modern, scalable, and secure technical architecture, leveraging the inherent strengths of the Base blockchain.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Frontend', value: 'React, Vite, Tailwind, Framer Motion' },
                { label: 'Backend', value: 'FastAPI (Python), WebSockets' },
                { label: 'AI Engines', value: 'Montra Engine V2, Qwen 2.5 32B' },
                { label: 'Integration', value: 'Ethers.js, Coinbase Wallet SDK' },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 rounded-lg bg-secondary border border-border">
                  <div className="text-xs font-bold text-muted-foreground uppercase mb-2">{label}</div>
                  <div className="text-sm font-medium text-foreground font-mono">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <h4 className="flex items-center gap-2 font-bold text-primary text-sm mb-2">
                <ShieldCheck size={16} /> Security First
              </h4>
              <p className="text-xs text-blue-700 font-mono leading-relaxed">
                Base Network Security, Robust API Key Management, Token-Based WebSocket Auth, and Comprehensive Input Sanitization ensure your assets are protected.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TokenomicsSection;
