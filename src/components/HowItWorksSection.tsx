const steps = [
  { num: 1, title: 'Connect Your Wallet', desc: 'Securely connect your Coinbase Smart Wallet or any Base-compatible wallet. Experience instant, low-cost transactions inherent to the Base network.' },
  { num: 2, title: 'Access the AI Terminal', desc: 'Engage with our intuitive AI chat terminal. Ask questions, request market analysis, and receive data-driven trading recommendations powered by the Montra Engine.' },
  { num: 3, title: 'Explore Strategies', desc: 'Browse the decentralized marketplace for a diverse range of quantitative trading strategies. Backtest performance and analyze risk metrics.' },
  { num: 4, title: 'Execute with Confidence', desc: 'Leverage real-time insights and automated execution. Monitor your portfolio through dynamic dashboards and 3D visualizations.' },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="px-6 sm:px-8 bg-background border-t border-border">
      <div className="mx-auto max-w-6xl py-24">
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest font-mono">How It Works</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-primary mb-4">Your Journey with Montra</h2>
          <p className="text-lg text-muted-foreground max-w-2xl font-mono">Seamlessly Navigate, Analyze, and Execute on Base.</p>
        </div>

        <div className="space-y-12">
          {[steps.slice(0, 2), steps.slice(2, 4)].map((pair, pairIdx) => (
            <div key={pairIdx} className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-start ${pairIdx === 0 ? 'border-b border-border pb-12' : ''}`}>
              {pair.map((step) => (
                <div key={step.num} className="relative pl-8 border-l border-border">
                  <span className="absolute -left-2.5 top-0 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold font-mono">
                    {step.num}
                  </span>
                  <h3 className="text-xl font-bold text-primary mb-3">{step.title}</h3>
                  <p className="text-muted-foreground mb-4 leading-relaxed font-mono text-sm">{step.desc}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
