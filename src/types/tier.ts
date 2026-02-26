export type TierId = 'none' | 'bronze' | 'silver' | 'gold' | 'diamond';

export interface TierDefinition {
  id: TierId;
  label: string;
  minTokens: number;
  color: string;        // tailwind text color
  bgColor: string;      // tailwind bg color
  borderColor: string;  // tailwind border color
  glow: string;         // shadow/glow class
  icon: string;         // emoji or symbol
  perks: string[];
}

export interface TierStatus {
  tier: TierId;
  balance: number;
  nextTier: TierId | null;
  tokensToNext: number;
  perks: string[];
}

/**
 * Tier thresholds (token amounts).
 * Adjust these as tokenomics evolve.
 */
export const TIER_THRESHOLDS: TierDefinition[] = [
  {
    id: 'diamond',
    label: 'DIAMOND',
    minTokens: 5_000_000_000,
    color: 'text-cyan-300',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/40',
    glow: 'shadow-[0_0_20px_rgba(34,211,238,0.25)]',
    icon: '◆',
    perks: [
      'Unlimited terminal queries',
      '50% burn discount',
      'Exclusive strategies',
      'Priority agent slots',
      'Diamond-only analytics',
    ],
  },
  {
    id: 'gold',
    label: 'GOLD',
    minTokens: 1_000_000_000,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/40',
    glow: 'shadow-[0_0_16px_rgba(234,179,8,0.2)]',
    icon: '★',
    perks: [
      '30% burn discount',
      'Advanced strategies unlocked',
      'Extra agent slots',
      'Gold analytics tier',
    ],
  },
  {
    id: 'silver',
    label: 'SILVER',
    minTokens: 500_000_000,
    color: 'text-slate-300',
    bgColor: 'bg-slate-400/10',
    borderColor: 'border-slate-400/40',
    glow: 'shadow-[0_0_12px_rgba(148,163,184,0.15)]',
    icon: '▲',
    perks: [
      '15% burn discount',
      'Silver strategy pack',
      'Enhanced agent monitoring',
    ],
  },
  {
    id: 'bronze',
    label: 'BRONZE',
    minTokens: 100_000_000,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/40',
    glow: 'shadow-[0_0_8px_rgba(251,146,60,0.1)]',
    icon: '●',
    perks: [
      '5% burn discount',
      'Basic holder badge',
    ],
  },
  {
    id: 'none',
    label: 'UNRANKED',
    minTokens: 0,
    color: 'text-muted-foreground',
    bgColor: 'bg-secondary/30',
    borderColor: 'border-border',
    glow: '',
    icon: '○',
    perks: [],
  },
];

/** Resolve tier from a token balance */
export function resolveTier(balance: number): TierStatus {
  // Thresholds are sorted highest-first
  const matched = TIER_THRESHOLDS.find((t) => balance >= t.minTokens) || TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];

  // Find next tier above current
  const currentIdx = TIER_THRESHOLDS.findIndex((t) => t.id === matched.id);
  const nextDef = currentIdx > 0 ? TIER_THRESHOLDS[currentIdx - 1] : null;

  return {
    tier: matched.id,
    balance,
    nextTier: nextDef?.id || null,
    tokensToNext: nextDef ? Math.max(0, nextDef.minTokens - balance) : 0,
    perks: matched.perks,
  };
}

/** Get tier definition by ID */
export function getTierDef(id: TierId): TierDefinition {
  return TIER_THRESHOLDS.find((t) => t.id === id) || TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];
}
