import type { AgentStatus } from '@/types/agent';

const statusConfig: Record<AgentStatus, { label: string; color: string; pulse: boolean }> = {
  active: { label: 'ACTIVE', color: 'text-primary', pulse: true },
  paused: { label: 'PAUSED', color: 'text-yellow-500', pulse: false },
  stopped: { label: 'STOPPED', color: 'text-muted-foreground', pulse: false },
  deploying: { label: 'DEPLOYING', color: 'text-blue-400', pulse: true },
  error: { label: 'ERROR', color: 'text-destructive', pulse: false },
};

const AgentStatusBadge = ({ status }: { status: AgentStatus }) => {
  const config = statusConfig[status];
  return (
    <span className={`text-[10px] font-mono font-bold uppercase flex items-center gap-1.5 ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.pulse ? 'animate-pulse' : ''} ${
        status === 'active' ? 'bg-primary' :
        status === 'paused' ? 'bg-yellow-500' :
        status === 'stopped' ? 'bg-muted-foreground' :
        status === 'deploying' ? 'bg-blue-400' :
        'bg-destructive'
      }`} />
      {config.label}
    </span>
  );
};

export default AgentStatusBadge;
