import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, MessageCircle } from 'lucide-react';

interface SentimentData {
  snapshot: {
    avg_score: number;
    cast_count: number;
    created_at: string;
  } | null;
  recent_casts: {
    cast_hash: string;
    author_name: string | null;
    cast_text: string;
    score: number;
    likes: number;
    recasts: number;
    analyzed_at: string;
  }[];
}

const SentimentWidget = () => {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sentiment/latest')
      .then((r) => r.json())
      .then(setData)
      .catch((err) => console.warn('Sentiment fetch failed:', err))
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      fetch('/api/sentiment/latest')
        .then((r) => r.json())
        .then(setData)
        .catch((err) => console.warn('Sentiment poll failed:', err));
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  const score = data?.snapshot?.avg_score ?? 0;
  const castCount = data?.snapshot?.cast_count ?? 0;

  const getSentimentLabel = (s: number) => {
    if (s >= 0.5) return 'Very Bullish';
    if (s >= 0.2) return 'Bullish';
    if (s > -0.2) return 'Neutral';
    if (s > -0.5) return 'Bearish';
    return 'Very Bearish';
  };

  const getSentimentColor = (s: number) => {
    if (s >= 0.2) return 'text-primary';
    if (s > -0.2) return 'text-muted-foreground';
    return 'text-destructive';
  };

  const SentimentIcon = score >= 0.2 ? TrendingUp : score <= -0.2 ? TrendingDown : Minus;

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageCircle size={14} className="text-primary" />
          <div>
            <p className="text-xs font-mono font-bold">SENTIMENT</p>
            <p className="text-[10px] text-muted-foreground font-mono">Farcaster</p>
          </div>
        </div>
        <span className="text-xs font-mono text-primary flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          LIVE
        </span>
      </div>

      {loading ? (
        <div className="py-4 text-center">
          <p className="text-[10px] font-mono text-muted-foreground">Loading sentiment...</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3">
            <SentimentIcon size={24} className={getSentimentColor(score)} />
            <div>
              <p className={`text-xl font-mono font-bold ${getSentimentColor(score)}`}>
                {score > 0 ? '+' : ''}{score.toFixed(2)}
              </p>
              <p className={`text-[10px] font-mono ${getSentimentColor(score)}`}>
                {getSentimentLabel(score)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-muted-foreground mb-3">
            <div>
              <p className="mb-1">CASTS (1H)</p>
              <p className="text-sm text-foreground font-bold">{castCount}</p>
            </div>
            <div>
              <p className="mb-1">UPDATED</p>
              <p className="text-sm text-foreground font-bold">
                {data?.snapshot?.created_at
                  ? new Date(data.snapshot.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '--:--'}
              </p>
            </div>
          </div>

          {/* Recent casts */}
          {data?.recent_casts && data.recent_casts.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-muted-foreground mb-2 uppercase">Recent Mentions</p>
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                {data.recent_casts.slice(0, 5).map((cast) => (
                  <div key={cast.cast_hash} className="flex items-start gap-2">
                    <span className={`text-[10px] font-mono font-bold shrink-0 w-10 text-right ${getSentimentColor(cast.score)}`}>
                      {cast.score > 0 ? '+' : ''}{cast.score.toFixed(1)}
                    </span>
                    <p className="text-[10px] font-mono text-muted-foreground truncate">
                      <span className="text-foreground">{cast.author_name || 'anon'}</span>{' '}
                      {cast.cast_text.slice(0, 80)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SentimentWidget;
