import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { getReputationSummary } from '@/lib/erc8004';

interface Props {
  erc8004AgentId: number;
}

const ReputationBadge = ({ erc8004AgentId }: Props) => {
  const [count, setCount] = useState<number>(0);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const summary = await getReputationSummary(erc8004AgentId);
        if (cancelled) return;
        setCount(summary.count);
        if (summary.count > 0) {
          const divisor = Math.pow(10, summary.summaryValueDecimals);
          setScore(summary.summaryValue / divisor);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [erc8004AgentId]);

  if (loading) return null;

  if (count === 0) {
    return (
      <span className="text-[10px] font-mono text-muted-foreground/50">No reviews</span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-[10px] font-mono text-yellow-500">
      <Star size={10} className="fill-yellow-500" />
      {score !== null ? score.toFixed(0) : '?'}/100
      <span className="text-muted-foreground ml-0.5">({count})</span>
    </span>
  );
};

export default ReputationBadge;
