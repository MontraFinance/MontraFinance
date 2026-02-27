import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3, Bot, Wallet, Activity, Signal, MessageSquare, History, Menu, X,
  Building2, Shield, KeyRound, Coins, DollarSign, Code2, Rocket,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const NAV_ITEMS = [
  { icon: BarChart3, label: 'Dashboard', to: '/dashboard', disabled: false },
  { icon: Bot, label: 'Agent Fleet', to: '/agents', disabled: false },
  { icon: Wallet, label: 'Portfolio', to: '/portfolio', disabled: false },
  { icon: Activity, label: 'Transactions', to: '/transactions', disabled: false },
  { icon: Signal, label: 'Analytics', to: '/analytics', disabled: false },
  { icon: Building2, label: 'Institutional', to: '/institutional', disabled: false },
  { icon: Shield, label: 'Compliance', to: '/compliance', disabled: false },
  { icon: KeyRound, label: 'Smart Accounts', to: '/smart-accounts', disabled: false },
  { icon: MessageSquare, label: 'Messages', to: '/messages', disabled: false },
  { icon: Coins, label: 'Tokens Analytics', to: '/tokens-analytics', disabled: false },
  { icon: DollarSign, label: 'Revenue', to: '/revenue', disabled: false },
  { icon: Code2, label: 'Dev Showcase', to: '/dev-showcase', disabled: false },
  { icon: History, label: 'Agent Orders', to: '/agents-history', disabled: false },
  { icon: Rocket, label: 'Launch Studio', to: '/launch-studio', disabled: false },
] as const;

export type NavPage = 'dashboard' | 'agents' | 'portfolio' | 'transactions' | 'analytics' | 'institutional' | 'compliance' | 'smart-accounts' | 'messages' | 'tokens-analytics' | 'revenue' | 'dev-showcase' | 'agents-history' | 'launch-studio';

const PAGE_TO_PATH: Record<NavPage, string> = {
  dashboard: '/dashboard',
  agents: '/agents',
  portfolio: '/portfolio',
  transactions: '/transactions',
  analytics: '/analytics',
  institutional: '/institutional',
  compliance: '/compliance',
  'smart-accounts': '/smart-accounts',
  messages: '/messages',
  'tokens-analytics': '/tokens-analytics',
  'revenue': '/revenue',
  'dev-showcase': '/dev-showcase',
  'agents-history': '/agents-history',
  'launch-studio': '/launch-studio',
};

function NavLinks({ activePath, onNavigate, pingCount = 0 }: { activePath: string; onNavigate?: () => void; pingCount?: number }) {
  return (
    <>
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">
        Navigation
      </span>
      {NAV_ITEMS.map(({ icon: Icon, label, to, disabled }) =>
        disabled ? (
          <button
            key={label}
            disabled
            className="flex items-center gap-2 text-sm font-mono px-3 py-2 rounded-lg mb-1 text-muted-foreground/50 cursor-not-allowed"
          >
            <Icon size={14} />
            {label}
          </button>
        ) : (
          <Link
            key={label}
            to={to}
            onClick={onNavigate}
            className={`flex items-center gap-2 text-sm font-mono px-3 py-2 rounded-lg mb-1 transition ${
              to === activePath
                ? 'text-foreground bg-secondary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Icon size={14} />
            {label}
            {label === 'Messages' && pingCount > 0 && (
              <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] text-[9px] font-mono font-bold bg-red-500 text-white rounded-full px-1">
                {pingCount > 99 ? '99+' : pingCount}
              </span>
            )}
          </Link>
        )
      )}
    </>
  );
}

export function AppSidebar({ activePage, pingCount = 0 }: { activePage: NavPage; pingCount?: number }) {
  const [open, setOpen] = useState(false);
  const activePath = PAGE_TO_PATH[activePage];

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-48 border-r border-border p-4 min-h-[calc(100vh-49px)]">
        <NavLinks activePath={activePath} pingCount={pingCount} />
      </aside>

      {/* Mobile menu button */}
      <div className="lg:hidden fixed bottom-4 left-4 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="relative flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition">
              {open ? <X size={20} /> : <Menu size={20} />}
              {pingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-[16px] text-[8px] font-bold bg-red-500 text-white rounded-full px-0.5">
                  {pingCount > 99 ? '99+' : pingCount}
                </span>
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-56 p-4">
            <NavLinks activePath={activePath} onNavigate={() => setOpen(false)} pingCount={pingCount} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
