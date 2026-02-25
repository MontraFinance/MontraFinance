import { useState, useEffect, useCallback } from 'react';
import {
  Coins, TrendingUp, Flame, BarChart3, ExternalLink,
  ChevronLeft, ChevronRight, X, RefreshCw, Rocket,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import TierBadge from '@/components/TierBadge';
import {
  fetchClawnchStats,
  fetchClawnchLaunches,
  type ClawnchStats,
  type ClawnchTopToken,
  type ClawnchLaunch,
  type ClawnchLaunchesResponse,
} from '@/services/clawnchApi';

// --- Helpers ---

const DashboardCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-card border border-border rounded-2xl p-4 ${className}`}>{children}</div>
);

function formatUsd(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPrice(s: string | undefined): string {
  if (!s) return '—';
  const n = parseFloat(s);
  if (isNaN(n)) return '—';
  if (n < 0.0001) return `$${n.toExponential(2)}`;
  return `$${n.toFixed(6)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatPct(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
}

// --- Section header ---

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Icon size={14} className="text-primary" />
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
        {title}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// --- Drill-down panel ---

function TokenDrillDown({
  token,
  onClose,
}: {
  token: ClawnchTopToken | ClawnchLaunch;
  onClose: () => void;
}) {
  const isTopToken = 'priceUsd' in token;
  const address = isTopToken ? (token as ClawnchTopToken).address : (token as ClawnchLaunch).contractAddress;
  const clankerUrl = token.clankerUrl;

  return (
    <DashboardCard className="border-primary/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold font-mono">{token.name}</span>
          <span className="text-xs text-muted-foreground font-mono">${token.symbol}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {isTopToken && (
          <>
            <div>
              <span className="text-[10px] text-muted-foreground font-mono uppercase">Price</span>
              <p className="text-sm font-bold font-mono">{formatPrice((token as ClawnchTopToken).priceUsd)}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground font-mono uppercase">Market Cap</span>
              <p className="text-sm font-bold font-mono">{formatUsd((token as ClawnchTopToken).marketCap)}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground font-mono uppercase">24h Volume</span>
              <p className="text-sm font-bold font-mono">{formatUsd((token as ClawnchTopToken).volume24h)}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground font-mono uppercase">24h Change</span>
              <p className={`text-sm font-bold font-mono ${((token as ClawnchTopToken).priceChange24h ?? 0) >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                {formatPct((token as ClawnchTopToken).priceChange24h)}
              </p>
            </div>
          </>
        )}
        {!isTopToken && (
          <>
            <div>
              <span className="text-[10px] text-muted-foreground font-mono uppercase">Agent</span>
              <p className="text-sm font-bold font-mono">{(token as ClawnchLaunch).agentName || '—'}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground font-mono uppercase">Source</span>
              <p className="text-sm font-bold font-mono">{(token as ClawnchLaunch).source || '—'}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground font-mono uppercase">Launched</span>
              <p className="text-sm font-bold font-mono">{formatDate((token as ClawnchLaunch).launchedAt)}</p>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs font-mono flex-wrap">
        <span className="text-muted-foreground">Contract:</span>
        <span className="text-foreground">{truncateAddress(address)}</span>
        {address && (
          <a
            href={`https://basescan.org/token/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            BaseScan <ExternalLink size={10} />
          </a>
        )}
        {clankerUrl && (
          <a
            href={clankerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            Clanker <ExternalLink size={10} />
          </a>
        )}
      </div>
    </DashboardCard>
  );
}

// --- Main page ---

export default function TokensAnalytics() {
  const [stats, setStats] = useState<ClawnchStats | null>(null);
  const [launches, setLaunches] = useState<ClawnchLaunchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [launchPage, setLaunchPage] = useState(0);
  const [selectedToken, setSelectedToken] = useState<ClawnchTopToken | ClawnchLaunch | null>(null);

  const PAGE_SIZE = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    const [s, l] = await Promise.all([
      fetchClawnchStats(),
      fetchClawnchLaunches(PAGE_SIZE, launchPage * PAGE_SIZE),
    ]);
    if (!s && !l) {
      setError(true);
    } else {
      setStats(s);
      setLaunches(l);
    }
    setLoading(false);
  }, [launchPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-widest font-mono uppercase">Tokens Analytics</span>
          <span className="text-[10px] font-mono text-primary border border-primary/30 px-2 py-0.5 rounded-full">
            Clawncher
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-muted-foreground hidden sm:block">{now}</span>
          <TierBadge />
          <ConnectWalletButton />
        </div>
      </header>

      <div className="flex">
        <AppSidebar activePage="tokens-analytics" />

        <main className="flex-1 p-4 md:p-6 space-y-6 overflow-x-hidden">
          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse h-32" />
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <DashboardCard>
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <span className="text-sm font-mono text-muted-foreground">
                  Failed to load data from Clawncher API
                </span>
                <button
                  onClick={loadData}
                  className="flex items-center gap-2 border border-primary/30 rounded-lg px-4 py-2 text-xs font-mono hover:bg-primary/10 transition"
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            </DashboardCard>
          )}

          {/* Data */}
          {!loading && !error && (
            <>
              {/* Section 1 — Platform Stats */}
              <section>
                <SectionHeader icon={BarChart3} title="Platform Stats" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <DashboardCard>
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">Total Tokens</span>
                    <p className="text-2xl font-bold font-mono mt-1">
                      {stats ? formatNumber(stats.tokenCount) : '—'}
                    </p>
                  </DashboardCard>
                  <DashboardCard>
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">Volume All Time</span>
                    <p className="text-2xl font-bold font-mono mt-1">
                      {stats ? formatUsd(stats.totalVolumeAllTime) : '—'}
                    </p>
                  </DashboardCard>
                  <DashboardCard>
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">24h Volume</span>
                    <p className="text-2xl font-bold font-mono mt-1">
                      {stats ? formatUsd(stats.totalVolume24h) : '—'}
                    </p>
                  </DashboardCard>
                  <DashboardCard>
                    <div className="flex items-center gap-1">
                      <Flame size={10} className="text-orange-500" />
                      <span className="text-[10px] text-muted-foreground font-mono uppercase">CLAWNCH Burned</span>
                    </div>
                    <p className="text-2xl font-bold font-mono mt-1">
                      {stats?.burnedClawnchFormatted ?? '—'}
                    </p>
                  </DashboardCard>
                </div>
              </section>

              {/* Drill-down panel */}
              {selectedToken && (
                <section>
                  <SectionHeader icon={Coins} title="Token Details" />
                  <TokenDrillDown token={selectedToken} onClose={() => setSelectedToken(null)} />
                </section>
              )}

              {/* Section 2 — Token Leaderboard */}
              {stats?.topTokens && stats.topTokens.length > 0 && (
                <section>
                  <SectionHeader icon={TrendingUp} title="Token Leaderboard" />
                  <DashboardCard className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="text-[10px] text-muted-foreground uppercase border-b border-border">
                          <th className="text-left py-2 pr-4">#</th>
                          <th className="text-left py-2 pr-4">Token</th>
                          <th className="text-left py-2 pr-4">Symbol</th>
                          <th className="text-right py-2 pr-4">Price</th>
                          <th className="text-right py-2 pr-4">Market Cap</th>
                          <th className="text-right py-2 pr-4">24h Vol</th>
                          <th className="text-right py-2 pr-4">24h Change</th>
                          <th className="text-left py-2">Agent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.topTokens.map((t, i) => (
                          <tr
                            key={t.address || i}
                            onClick={() => setSelectedToken(t)}
                            className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition cursor-pointer"
                          >
                            <td className="py-2.5 pr-4 text-muted-foreground">{i + 1}</td>
                            <td className="py-2.5 pr-4">{t.name}</td>
                            <td className="py-2.5 pr-4 text-muted-foreground">${t.symbol}</td>
                            <td className="py-2.5 pr-4 text-right">{formatPrice(t.priceUsd)}</td>
                            <td className="py-2.5 pr-4 text-right">{formatUsd(t.marketCap)}</td>
                            <td className="py-2.5 pr-4 text-right">{formatUsd(t.volume24h)}</td>
                            <td className={`py-2.5 pr-4 text-right ${(t.priceChange24h ?? 0) >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                              {formatPct(t.priceChange24h)}
                            </td>
                            <td className="py-2.5 text-muted-foreground">{t.agent || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </DashboardCard>
                </section>
              )}

              {/* Section 3 — Launch Feed */}
              <section>
                <SectionHeader icon={Rocket} title="Launch Feed" />
                <DashboardCard className="overflow-x-auto">
                  {launches && launches.launches.length > 0 ? (
                    <>
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr className="text-[10px] text-muted-foreground uppercase border-b border-border">
                            <th className="text-left py-2 pr-4">Token</th>
                            <th className="text-left py-2 pr-4">Symbol</th>
                            <th className="text-left py-2 pr-4">Contract</th>
                            <th className="text-left py-2 pr-4">Agent</th>
                            <th className="text-left py-2 pr-4">Source</th>
                            <th className="text-left py-2">Launched</th>
                          </tr>
                        </thead>
                        <tbody>
                          {launches.launches.map((l, i) => (
                            <tr
                              key={l.contractAddress || i}
                              onClick={() => setSelectedToken(l)}
                              className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition cursor-pointer"
                            >
                              <td className="py-2.5 pr-4">{l.name}</td>
                              <td className="py-2.5 pr-4 text-muted-foreground">${l.symbol}</td>
                              <td className="py-2.5 pr-4">
                                <a
                                  href={`https://basescan.org/token/${l.contractAddress}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="text-primary hover:underline flex items-center gap-1"
                                >
                                  {truncateAddress(l.contractAddress)}
                                  <ExternalLink size={10} />
                                </a>
                              </td>
                              <td className="py-2.5 pr-4">{l.agentName || '—'}</td>
                              <td className="py-2.5 pr-4 text-muted-foreground">{l.source || '—'}</td>
                              <td className="py-2.5">{formatDate(l.launchedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Pagination */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                        <button
                          disabled={launchPage === 0}
                          onClick={() => setLaunchPage(p => Math.max(0, p - 1))}
                          className="flex items-center gap-1 text-xs font-mono border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={12} /> Previous
                        </button>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          Page {launchPage + 1}
                          {launches.total > 0 && ` of ${Math.ceil(launches.total / PAGE_SIZE)}`}
                        </span>
                        <button
                          disabled={!launches.total || (launchPage + 1) * PAGE_SIZE >= launches.total}
                          onClick={() => setLaunchPage(p => p + 1)}
                          className="flex items-center gap-1 text-xs font-mono border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Next <ChevronRight size={12} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm font-mono text-muted-foreground text-center py-8">
                      No launches found.
                    </p>
                  )}
                </DashboardCard>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
