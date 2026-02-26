import { Send } from 'lucide-react';

const CTASection = () => {
  return (
    <section className="bg-background border-t border-border px-6 sm:px-8">
      <div className="max-w-4xl mx-auto py-24 text-center">
        <div className="mb-10">
          <h3 className="text-3xl md:text-4xl font-medium text-primary leading-tight mb-6">
            Be Part of the Future of DeFi on Base.
          </h3>
          <p className="text-muted-foreground text-lg mb-8 font-mono max-w-xl mx-auto">
            Join a growing community of traders, developers, and innovators shaping the future of quantitative finance.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href="https://t.me/Montra_Finance" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 bg-card border border-border text-primary rounded-full text-sm font-medium hover:bg-secondary transition-colors font-mono">
              <Send size={16} /> Telegram
            </a>
            <a href="https://x.com/MontraFinance" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 bg-card border border-border text-primary rounded-full text-sm font-medium hover:bg-secondary transition-colors font-mono">
              Follow @MontraFinance
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
