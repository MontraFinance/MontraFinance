import { ArrowDownRight, CheckCircle, ShieldCheck } from 'lucide-react';
import TechMotionGraphic from './TechMotionGraphic';

const AboutSection = () => {
  return (
    <section id="about" className="sm:px-8 px-6 pt-20 pb-16 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Animated visualization */}
          <div className="lg:col-span-5">
            <div className="relative overflow-hidden bg-secondary/30 border border-border rounded-2xl aspect-[4/5]">
              <TechMotionGraphic />
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-7">
            <div className="flex flex-col justify-center h-full">
              <div className="flex items-center gap-3 mb-6">
                <ArrowDownRight className="text-muted-foreground" size={16} />
                <div className="h-px flex-1 bg-border" />
              </div>

              <h2 className="text-3xl font-semibold text-primary mb-6 tracking-tight">
                Redefining DeFi Trading with Institutional Precision
              </h2>
              <p className="text-lg leading-relaxed text-muted-foreground mb-8 font-mono">
                Montra Finance is pioneering the next generation of decentralized finance, offering an institutional-grade AI trading intelligence platform built natively on the high-performance Base blockchain. We empower traders, from seasoned professionals to emerging quants, with unparalleled analytical capabilities, risk management tools, and a vibrant marketplace for trading strategies.
              </p>

              {/* Tech Stack */}
              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-primary font-mono uppercase tracking-wide">Core Tech</h3>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    {['Montra Engine V2', 'Qwen 2.5 32B LLM', 'Base Blockchain'].map((item) => (
                      <li key={item} className="font-mono flex items-center gap-2">
                        <CheckCircle size={14} className="text-muted-foreground/60" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-primary font-mono uppercase tracking-wide">Security</h3>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    {['Token-Based Auth', 'Rate Limiting', 'Input Sanitization'].map((item) => (
                      <li key={item} className="font-mono flex items-center gap-2">
                        <ShieldCheck size={14} className="text-muted-foreground/60" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex gap-4">
                <a href="/dashboard" className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors font-mono text-sm">
                  Launch Terminal
                </a>
                <a href="#features" className="px-6 py-3 rounded-lg border border-border text-primary font-medium hover:bg-secondary transition-colors font-mono text-sm">
                  Documentation
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
