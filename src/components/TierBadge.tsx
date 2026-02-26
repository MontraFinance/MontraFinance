import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Flame, Shield, Zap, Crown, Gem, Lock } from 'lucide-react';
import { useTier } from '@/contexts/TierContext';
import { useWallet } from '@/contexts/WalletContext';
import { getTierDef } from '@/types/tier';
import type { TierId } from '@/types/tier';

const TIER_ICONS: Record<TierId, typeof Shield> = {
  none: Lock,
  bronze: Flame,
  silver: Shield,
  gold: Crown,
  diamond: Gem,
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const TierBadge = () => {
  const { connected } = useWallet();
  const { tier, balance, nextTier, tokensToNext, burnDiscount, maxAgents, perks, loading, configured } = useTier();
  const [expanded, setExpanded] = useState(false);

  if (!connected) return null;

  const def = getTierDef(tier);
  const Icon = TIER_ICONS[tier];
  const nextDef = nextTier ? getTierDef(nextTier) : null;

  // Progress to next tier (0-100)
  const progressPct = nextDef
    ? Math.min(100, Math.round((balance / nextDef.minTokens) * 100))
    : 100;

  return (
    <div className="relative">
      {/* Badge button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg border transition-all ${def.color} ${def.bgColor} ${def.borderColor} ${def.glow} hover:brightness-110`}
      >
        {loading ? (
          <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Icon size={12} />
        )}
        <span>{def.label}</span>
        <ChevronDown size={10} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 top-full mt-2 w-72 bg-card border rounded-xl overflow-hidden z-50 ${def.borderColor} ${def.glow}`}
          >
            {/* Header */}
            <div className={`px-4 py-3 border-b ${def.borderColor} ${def.bgColor}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Icon size={16} className={def.color} />
                  <span className={`text-sm font-mono font-bold ${def.color}`}>{def.label} HOLDER</span>
                </div>
                {burnDiscount > 0 && (
                  <span className="text-[9px] font-mono font-bold text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
                    -{burnDiscount}% BURN
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                {configured ? `${formatTokens(balance)} $MONTRA` : 'Token not configured'}
              </p>
            </div>

            {/* Progress to next tier */}
            {nextDef && configured && (
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-mono text-muted-foreground uppercase">
                    Next: {nextDef.label}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    {formatTokens(tokensToNext)} to go
                  </span>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.6 }}
                    className={`h-full rounded-full ${
                      nextTier === 'diamond' ? 'bg-cyan-400' :
                      nextTier === 'gold' ? 'bg-yellow-400' :
                      nextTier === 'silver' ? 'bg-slate-400' :
                      'bg-orange-400'
                    }`}
                  />
                </div>
                <p className="text-[9px] font-mono text-muted-foreground mt-1 text-right">
                  {progressPct}% complete
                </p>
              </div>
            )}

            {/* Perks */}
            {perks.length > 0 && (
              <div className="px-4 py-3 border-b border-border">
                <p className="text-[9px] font-mono text-muted-foreground uppercase mb-2">Your Perks</p>
                <div className="space-y-1.5">
                  {perks.map((perk) => (
                    <div key={perk} className="flex items-start gap-2">
                      <Zap size={10} className="text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-[10px] font-mono text-foreground leading-tight">{perk}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats row */}
            <div className="px-4 py-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[9px] font-mono text-muted-foreground uppercase">Burn Discount</p>
                <p className={`text-sm font-mono font-bold ${burnDiscount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {burnDiscount}%
                </p>
              </div>
              <div>
                <p className="text-[9px] font-mono text-muted-foreground uppercase">Max Agents</p>
                <p className="text-sm font-mono font-bold text-foreground">{maxAgents}</p>
              </div>
            </div>

            {/* Tier ladder */}
            {tier === 'none' && (
              <div className="px-4 py-3 border-t border-border">
                <p className="text-[9px] font-mono text-muted-foreground uppercase mb-2">Tier Ladder</p>
                <div className="space-y-1">
                  {(['bronze', 'silver', 'gold', 'diamond'] as TierId[]).map((t) => {
                    const d = getTierDef(t);
                    return (
                      <div key={t} className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono font-bold ${d.color}`}>
                          {d.icon} {d.label}
                        </span>
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {formatTokens(d.minTokens)} $MONTRA
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click-away overlay */}
      {expanded && (
        <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
      )}
    </div>
  );
};

export default TierBadge;
