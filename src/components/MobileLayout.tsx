import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Wallet, Activity, Signal } from 'lucide-react';
import MobileHeader from '@/components/MobileHeader';

const TABS = [
  { icon: BarChart3, label: 'Terminal', path: '/baseapp' },
  { icon: Wallet, label: 'Portfolio', path: '/baseapp/portfolio' },
  { icon: Activity, label: 'Txns', path: '/baseapp/transactions' },
  { icon: Signal, label: 'Analytics', path: '/baseapp/analytics' },
] as const;

const MobileLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MobileHeader />

      {/* Main content area with clearance for header + tab bar */}
      <main className="pt-12 pb-16 px-4">
        {children}
      </main>

      {/* Fixed bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 h-14 bg-background/95 backdrop-blur-sm border-t border-border flex items-center justify-around"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 transition ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon size={18} />
              <span className="text-[9px] font-mono font-bold">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default MobileLayout;
