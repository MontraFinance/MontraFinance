import { Twitter, Github, Send } from 'lucide-react';

const FooterSection = () => {
  return (
    <footer className="bg-surface-elevated border-t border-border px-6 sm:px-8">
      <div className="mx-auto max-w-6xl py-12 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <div className="font-bold text-lg tracking-tight mb-4 text-primary">Montra Finance</div>
            <p className="text-muted-foreground text-xs font-mono mb-4">© 2026 Montra Finance.<br />All rights reserved.</p>
            <p className="text-muted-foreground/60 text-xs font-mono">Built with passion on Base.</p>
          </div>

          <div>
            <h4 className="font-bold text-sm mb-4 text-primary">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground font-mono">
              <li><a href="#features" className="hover:text-primary transition">Features</a></li>
              <li><a href="#tokenomics" className="hover:text-primary transition">Tokenomics</a></li>
              <li><a href="/docs" className="hover:text-primary transition">Developer Docs</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm mb-4 text-primary">Legal & Social</h4>
            <ul className="space-y-2 text-sm text-muted-foreground font-mono">
              <li><a href="/privacy" className="hover:text-primary transition">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-primary transition">Terms of Service</a></li>
              <li className="pt-2 flex gap-4">
                <a href="https://x.com/MontraFinance" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition"><Twitter size={18} /></a>
                <a href="https://github.com/MontraFinance/MontraFinance" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition"><Github size={18} /></a>
                <a href="https://t.me/Montra_Finance" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition"><Send size={18} /></a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
