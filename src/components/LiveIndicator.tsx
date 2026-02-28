import type { RealtimeStatus } from '@/hooks/useRealtimeAgents';

const cfg: Record<RealtimeStatus, { label: string; dot: string; text: string }> = {
  connected:    { label: 'LIVE',       dot: 'bg-emerald-500 animate-pulse', text: 'text-emerald-600' },
  connecting:   { label: 'CONNECTING', dot: 'bg-amber-500 animate-pulse',   text: 'text-amber-600'   },
  disconnected: { label: 'OFFLINE',    dot: 'bg-muted-foreground',          text: 'text-muted-foreground' },
  error:        { label: 'ERROR',      dot: 'bg-destructive',              text: 'text-destructive' },
};

const LiveIndicator = ({ status, className = '' }: { status: RealtimeStatus; className?: string }) => {
  const c = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold ${c.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

export default LiveIndicator;
