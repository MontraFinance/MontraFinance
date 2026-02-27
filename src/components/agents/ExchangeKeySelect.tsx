import { useState } from 'react';
import { Globe, Key, Plus } from 'lucide-react';
import { useAgents } from '@/contexts/AgentContext';
import ExchangeKeyManager from './ExchangeKeyManager';
import type { ExchangeName } from '@/types/agent';

interface ExchangeKeySelectProps {
  value: string | null;
  onChange: (exchangeKeyId: string | null) => void;
  /** Custom label — defaults to "Trading Venue" */
  label?: string;
  /** Hide the "On-Chain (CoW Protocol)" option (useful for monitor mode) */
  hideOnChain?: boolean;
}

const EXCHANGE_ICONS: Record<string, string> = {
  binance: '🟡',
  coinbase: '🔵',
  bybit: '🟠',
  okx: '⚫',
  bitunix: '🟢',
};

const EXCHANGE_NAMES: Record<string, string> = {
  binance: 'Binance',
  coinbase: 'Coinbase',
  bybit: 'Bybit',
  okx: 'OKX',
  bitunix: 'Bitunix',
};

const ExchangeKeySelect = ({ value, onChange, label, hideOnChain }: ExchangeKeySelectProps) => {
  const { exchangeKeys } = useAgents();
  const [showManager, setShowManager] = useState(false);

  // Group keys by exchange
  const grouped = exchangeKeys.reduce<Record<string, typeof exchangeKeys>>((acc, key) => {
    if (!acc[key.exchange]) acc[key.exchange] = [];
    acc[key.exchange].push(key);
    return acc;
  }, {});

  const selectedKey = value ? exchangeKeys.find(k => k.id === value) : null;

  return (
    <div>
      <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1.5">
        {label || 'Trading Venue'}
      </label>

      <div className="space-y-1.5">
        {/* On-Chain default option — hidden for monitor mode */}
        {!hideOnChain && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition ${
              !value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/30'
            }`}
          >
            <Globe size={14} className={!value ? 'text-primary' : 'text-muted-foreground'} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-mono font-bold ${!value ? 'text-primary' : 'text-foreground'}`}>
                On-Chain (CoW Protocol)
              </p>
              <p className="text-[9px] font-mono text-muted-foreground">
                MEV-protected DEX trading on Base
              </p>
            </div>
            {!value && (
              <span className="text-[8px] font-mono text-primary bg-primary/10 rounded px-1.5 py-0.5">DEFAULT</span>
            )}
          </button>
        )}

        {/* Exchange key options */}
        {Object.entries(grouped).map(([exchange, keys]) => (
          <div key={exchange}>
            {keys.map(key => (
              <button
                key={key.id}
                type="button"
                onClick={() => onChange(key.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition ${
                  value === key.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <span className="text-sm">{EXCHANGE_ICONS[exchange] || '🔑'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-mono font-bold ${value === key.id ? 'text-primary' : 'text-foreground'}`}>
                    {key.label}
                  </p>
                  <p className="text-[9px] font-mono text-muted-foreground">
                    {EXCHANGE_NAMES[exchange] || exchange} &middot; {key.apiKeyMasked}
                  </p>
                </div>
                {value === key.id && (
                  <span className="text-[8px] font-mono text-primary bg-primary/10 rounded px-1.5 py-0.5">SELECTED</span>
                )}
              </button>
            ))}
          </div>
        ))}

        {/* Connect new exchange button */}
        <button
          type="button"
          onClick={() => setShowManager(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition"
        >
          <Plus size={12} />
          <span className="text-[10px] font-mono">Connect Exchange</span>
        </button>
      </div>

      <ExchangeKeyManager open={showManager} onClose={() => setShowManager(false)} />
    </div>
  );
};

export default ExchangeKeySelect;
