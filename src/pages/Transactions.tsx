import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ExternalLink, Flame, RefreshCw } from 'lucide-react';
import LaunchCountdown from '@/components/LaunchCountdown';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { useWallet } from '@/contexts/WalletContext';
import { getBurnHistory } from '@/services/burnService';
import type { BurnRecord } from '@/types/burn';
import { AppSidebar } from '@/components/AppSidebar';
import { Skeleton } from '@/components/ui/skeleton';

const BASE_EXPLORER = 'https://basescan.org/tx/';

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  signed: { label: 'Signed', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  confirmed: { label: 'Confirmed', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  processed: { label: 'Processed', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  failed: { label: 'Failed', color: 'text-red-600 bg-red-50 border-red-200' },
};

const COMPLEXITY_STYLES: Record<string, { label: string; color: string }> = {
  simple: { label: 'Simple', color: 'text-emerald-600' },
  standard: { label: 'Standard', color: 'text-blue-600' },
  medium: { label: 'Medium', color: 'text-amber-600' },
  complex: { label: 'Complex', color: 'text-orange-600' },
  very_complex: { label: 'Very Complex', color: 'text-red-600' },
};

function truncateHash(hash: string): string {
  if (!hash || hash.length < 12) return hash || '—';
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const Transactions = () => {
  const { connected, fullWalletAddress } = useWallet();
  const [burns, setBurns] = useState<BurnRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBurns = () => {
    if (!connected || !fullWalletAddress) return;
    setLoading(true);
    setError(null);
    getBurnHistory(fullWalletAddress, 100)
      .then((res) => {
        if (res.success) {
          setBurns(res.burns);
          setTotal(res.total);
        } else {
          setError('Failed to load burn history');
        }
      })
      .catch(() => setError('Failed to load burn history'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBurns();
  }, [connected, fullWalletAddress]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LaunchCountdown title="Transactions" />
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-mono font-bold tracking-wider">TRANSACTIONS</h1>
          <span className="text-xs font-mono text-primary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {total} BURNS
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
            {new Date().toLocaleString()}
          </span>
          <ConnectWalletButton />
        </div>
      </header>

      <div className="flex">
        <AppSidebar activePage="transactions" />

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6">
          {!connected ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Activity size={40} className="text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-sm font-mono font-bold text-foreground mb-2">WALLET REQUIRED</h2>
              <p className="text-[10px] font-mono text-muted-foreground mb-6">
                Connect your wallet to view burn transaction history.
              </p>
              <ConnectWalletButton />
            </div>
          ) : loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
              </div>
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : error ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Activity size={40} className="text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-sm font-mono font-bold text-foreground mb-2">ERROR</h2>
              <p className="text-[10px] font-mono text-muted-foreground mb-4">{error}</p>
              <button
                onClick={fetchBurns}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2.5 hover:bg-primary/80 transition"
              >
                <RefreshCw size={12} /> RETRY
              </button>
            </div>
          ) : burns.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Flame size={40} className="text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-sm font-mono font-bold text-foreground mb-2">NO TRANSACTIONS</h2>
              <p className="text-[10px] font-mono text-muted-foreground mb-6">
                You haven't burned any tokens yet. Burn tokens to query the AI terminal.
              </p>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2.5 hover:bg-primary/80 transition"
              >
                GO TO TERMINAL
              </Link>
            </div>
          ) : (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-card border border-border rounded-2xl p-4">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Total Burns</p>
                  <p className="text-2xl font-mono font-bold">{total}</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Tokens Burned</p>
                  <p className="text-2xl font-mono font-bold text-primary">
                    {burns.reduce((sum, b) => sum + b.amount_burned, 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Confirmed</p>
                  <p className="text-2xl font-mono font-bold text-emerald-600">
                    {burns.filter((b) => b.status === 'confirmed' || b.status === 'processed').length}
                  </p>
                </div>
              </div>

              {/* Table */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-mono">
                    <thead>
                      <tr className="border-b border-border text-[10px] text-muted-foreground uppercase">
                        <th className="text-left px-4 py-3 font-medium">Date</th>
                        <th className="text-left px-4 py-3 font-medium">Query</th>
                        <th className="text-right px-4 py-3 font-medium">Tokens</th>
                        <th className="text-center px-4 py-3 font-medium">Complexity</th>
                        <th className="text-center px-4 py-3 font-medium">Status</th>
                        <th className="text-right px-4 py-3 font-medium">Tx Hash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {burns.map((burn) => {
                        const st = STATUS_STYLES[burn.status] || STATUS_STYLES.pending;
                        const cx = COMPLEXITY_STYLES[burn.complexity] || COMPLEXITY_STYLES.simple;
                        return (
                          <tr key={burn.id} className="border-b border-border/50 hover:bg-secondary/30 transition">
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(burn.created_at)}
                            </td>
                            <td className="px-4 py-3 text-xs text-foreground max-w-[200px] truncate" title={burn.query_text}>
                              {burn.query_text}
                            </td>
                            <td className="px-4 py-3 text-xs text-right font-bold text-primary whitespace-nowrap">
                              {burn.amount_burned.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-[10px] font-semibold ${cx.color}`}>{cx.label}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border ${st.color}`}>
                                {st.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {burn.burn_signature ? (
                                <a
                                  href={`${BASE_EXPLORER}${burn.burn_signature}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                                >
                                  {truncateHash(burn.burn_signature)}
                                  <ExternalLink size={10} />
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Transactions;
