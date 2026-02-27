import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ExternalLink, Flame, RefreshCw } from 'lucide-react';
import MobileLayout from '@/components/MobileLayout';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { useWallet } from '@/contexts/WalletContext';
import { getBurnHistory } from '@/services/burnService';
import type { BurnRecord } from '@/types/burn';
import { Skeleton } from '@/components/ui/skeleton';

const BASE_EXPLORER = 'https://basescan.org/tx/';

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: 'bg-amber-500/10', text: 'text-amber-500' },
  signed: { label: 'Signed', bg: 'bg-blue-500/10', text: 'text-blue-500' },
  confirmed: { label: 'Confirmed', bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  processed: { label: 'Processed', bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  failed: { label: 'Failed', bg: 'bg-red-500/10', text: 'text-red-500' },
};

const COMPLEXITY_STYLES: Record<string, { label: string; color: string }> = {
  simple: { label: 'Simple', color: 'text-emerald-500' },
  standard: { label: 'Standard', color: 'text-blue-500' },
  medium: { label: 'Medium', color: 'text-amber-500' },
  complex: { label: 'Complex', color: 'text-orange-500' },
  very_complex: { label: 'V. Complex', color: 'text-red-500' },
};

function truncateHash(hash: string): string {
  if (!hash || hash.length < 12) return hash || '\u2014';
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const MobileTransactions = () => {
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

  useEffect(() => { fetchBurns(); }, [connected, fullWalletAddress]);

  return (
    <MobileLayout>
      <div className="py-3 space-y-3">
        {!connected ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Activity size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <h2 className="text-sm font-mono font-bold mb-2">WALLET REQUIRED</h2>
            <p className="text-[10px] font-mono text-muted-foreground mb-4">
              Connect your wallet to view burn history.
            </p>
            <ConnectWalletButton />
          </div>
        ) : loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
            {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : error ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Activity size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <h2 className="text-sm font-mono font-bold mb-2">ERROR</h2>
            <p className="text-[10px] font-mono text-muted-foreground mb-3">{error}</p>
            <button
              onClick={fetchBurns}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2 hover:bg-primary/80 transition"
            >
              <RefreshCw size={12} /> RETRY
            </button>
          </div>
        ) : burns.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Flame size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <h2 className="text-sm font-mono font-bold mb-2">NO TRANSACTIONS</h2>
            <p className="text-[10px] font-mono text-muted-foreground mb-4">
              Burn tokens to query the AI terminal.
            </p>
            <Link
              to="/baseapp"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-lg px-4 py-2 hover:bg-primary/80 transition"
            >
              GO TO TERMINAL
            </Link>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-mono font-bold uppercase text-muted-foreground">Burn History</p>
              <button
                onClick={fetchBurns}
                disabled={loading}
                className="text-muted-foreground hover:text-foreground transition"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-card border border-border rounded-xl p-2.5 text-center">
                <p className="text-[8px] font-mono text-muted-foreground uppercase">Burns</p>
                <p className="text-lg font-mono font-bold">{total}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-2.5 text-center">
                <p className="text-[8px] font-mono text-muted-foreground uppercase">Tokens</p>
                <p className="text-lg font-mono font-bold text-primary">
                  {burns.reduce((sum, b) => sum + b.amount_burned, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-2.5 text-center">
                <p className="text-[8px] font-mono text-muted-foreground uppercase">Confirmed</p>
                <p className="text-lg font-mono font-bold text-emerald-500">
                  {burns.filter((b) => b.status === 'confirmed' || b.status === 'processed').length}
                </p>
              </div>
            </div>

            {/* Burn cards */}
            <div className="space-y-2">
              {burns.map((burn) => {
                const st = STATUS_STYLES[burn.status] || STATUS_STYLES.pending;
                const cx = COMPLEXITY_STYLES[burn.complexity] || COMPLEXITY_STYLES.simple;
                return (
                  <div key={burn.id} className="bg-card border border-border rounded-2xl p-3 space-y-2">
                    {/* Top row: date + status */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground">{formatDate(burn.created_at)}</span>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md ${st.bg} ${st.text}`}>
                        {st.label}
                      </span>
                    </div>

                    {/* Query text */}
                    <p className="text-xs font-mono text-foreground line-clamp-2">{burn.query_text}</p>

                    {/* Bottom row: tokens + complexity + tx hash */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-primary">
                          {burn.amount_burned.toLocaleString()} tokens
                        </span>
                        <span className={`text-[9px] font-mono font-bold ${cx.color}`}>{cx.label}</span>
                      </div>
                      {burn.burn_signature && (
                        <a
                          href={`${BASE_EXPLORER}${burn.burn_signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] font-mono text-blue-500"
                        >
                          {truncateHash(burn.burn_signature)}
                          <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </MobileLayout>
  );
};

export default MobileTransactions;
