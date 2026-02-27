import { LineChart, Line, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import type { PnlDataPoint } from '@/types/agent';

const AgentPerformanceChart = ({ data, compact = true }: { data: PnlDataPoint[]; compact?: boolean }) => {
  const isPositive = data.length > 0 && data[data.length - 1].pnl >= 0;

  return (
    <ResponsiveContainer width="100%" height={compact ? 80 : 200}>
      <LineChart data={data}>
        <ReferenceLine y={0} stroke="rgba(128,128,128,0.2)" strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="pnl"
          stroke={isPositive ? 'hsl(240, 100%, 50%)' : 'hsl(0, 84%, 60%)'}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(0, 0%, 100%)',
            border: '1px solid hsl(0, 0%, 90%)',
            borderRadius: '8px',
            fontSize: '10px',
            fontFamily: 'monospace',
          }}
          formatter={(val: number) => [`$${val.toFixed(2)}`, 'P&L']}
          labelFormatter={() => ''}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default AgentPerformanceChart;
