import { Cpu, MessageCircle, Store, Box } from 'lucide-react';
import DitherGraphic from './DitherGraphic';

type DitherVariant = 'engine' | 'terminal' | 'marketplace' | 'visualizations';

const features: {
  icon: typeof Cpu;
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  dither: DitherVariant;
}[] = [
  {
    icon: Cpu,
    badge: 'Quantitative Edge',
    badgeColor: 'bg-blue-50 text-blue-600 border-blue-100',
    title: 'Montra Engine',
    description: 'AI-Powered Quantitative Edge. Our proprietary Multi-Context Framework (Montra) Engine provides real-time scores for trade quality, analyzing market structure, volume confluence, and volatility regimes. Stop guessing, start quantifying.',
    dither: 'engine',
  },
  {
    icon: MessageCircle,
    badge: 'Intuitive Intelligence',
    badgeColor: 'bg-purple-50 text-purple-600 border-purple-100',
    title: 'Conversational AI Terminal',
    description: 'Interact with a fine-tuned Large Language Model (LLM) specialized for trading. Our AI provides context-aware market analysis, risk assessments, and trading recommendations in natural language.',
    dither: 'terminal',
  },
  {
    icon: Store,
    badge: 'Monetize Alpha',
    badgeColor: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    title: 'Decentralized Strategy Marketplace',
    description: 'The Montra Finance marketplace connects talented quants with traders seeking proven strategies. Publish your algorithms, earn passive income, or subscribe to top-performing strategies.',
    dither: 'marketplace',
  },
  {
    icon: Box,
    badge: 'Visualize Edge',
    badgeColor: 'bg-amber-50 text-amber-600 border-amber-100',
    title: 'Real-Time 3D Visualizations',
    description: 'Experience market dynamics like never before with 48 interactive 3D visualizations. From topological data analysis to risk geometry, gain deeper insights into market microstructure.',
    dither: 'visualizations',
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="sm:px-8 px-6 bg-surface-elevated border-t border-border">
      <div className="py-24 max-w-6xl mx-auto">
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest font-mono">The Montra Advantage</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-primary mb-4">Your Unfair Advantage</h2>
          <p className="text-lg text-muted-foreground font-mono max-w-2xl">
            Cutting-edge tools designed to navigate the complexities of crypto markets on Base.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map(({ icon: Icon, badge, badgeColor, title, description, dither }) => (
            <div key={title} className="group bg-card border border-border rounded-2xl p-8 hover:shadow-xl transition-all duration-300">
              <div className="rounded-xl border border-border overflow-hidden bg-secondary/30 mb-6 aspect-[16/9]">
                <DitherGraphic variant={dither} className="h-full" />
              </div>
              <div className={`inline-flex gap-2 items-center ${badgeColor} px-3 py-1 rounded-full text-xs font-medium font-mono mb-4 border`}>
                <Icon size={16} /> {badge}
              </div>
              <h3 className="text-xl font-semibold text-primary mb-3">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed font-mono">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
