/**
 * Query complexity detection and burn pricing.
 * 1:1 port from QuiverTerminal burn-pricing.ts (additive multiplier model).
 */

export type ComplexityLevel = "simple" | "medium" | "complex" | "very_complex";

export interface PricingResult {
  baseCost: number;
  complexityMultiplier: number;
  resourceMultiplier: number;
  totalCost: number;
  breakdown: {
    base: number;
    complexity: number;
    resources: number;
  };
}

const BASE_COST = parseInt(process.env.BURN_BASE_COST || "200", 10);

const COMPLEXITY_MULTIPLIERS: Record<ComplexityLevel, number> = {
  simple: 1,
  medium: 2,
  complex: 5,
  very_complex: 10,
};

// USD cost per complexity tier (exponential scaling)
// simple=$0.25, medium=$0.75, complex=$2.50, very_complex=$8.00
const USD_COST_TIERS: Record<ComplexityLevel, number> = {
  simple: 1,      // 1x base ($0.25)
  medium: 3,      // 3x base ($0.75)
  complex: 10,    // 10x base ($2.50)
  very_complex: 32, // 32x base ($8.00)
};

// Resource multipliers (additive, matching QT)
const RESOURCE_MULTIPLIERS = {
  realTimeData: 1.5,
  historicalData: 1.3,
  multipleMarkets: 1.4,
};

// Very complex indicators (1:1 from QT burn-pricing.ts)
const VERY_COMPLEX_INDICATORS = [
  "backtest",
  "monte carlo",
  "portfolio",
  "correlation",
  "regression",
  "optimization",
  "strategy",
];

// Complex indicators (1:1 from QT burn-pricing.ts)
const COMPLEX_INDICATORS = [
  "analyze",
  "compare",
  "trend",
  "forecast",
  "prediction",
  "signal",
  "indicator",
];

/**
 * Analyzes query to determine complexity (1:1 from QT analyzeComplexity)
 */
export function analyzeComplexity(query: string): ComplexityLevel {
  const lowerQuery = query.toLowerCase();

  if (VERY_COMPLEX_INDICATORS.some((indicator) => lowerQuery.includes(indicator))) {
    return "very_complex";
  }

  if (COMPLEX_INDICATORS.some((indicator) => lowerQuery.includes(indicator))) {
    return "complex";
  }

  if (query.length > 200) {
    return "medium";
  }

  return "simple";
}

/**
 * Detects resource requirements from query (1:1 from QT detectResourceRequirements)
 */
export function detectResourceRequirements(query: string): {
  requiresRealTimeData: boolean;
  requiresHistoricalData: boolean;
  requiresMultipleMarkets: boolean;
} {
  const lowerQuery = query.toLowerCase();

  return {
    requiresRealTimeData: /real.?time|live|current|now|today/.test(lowerQuery),
    requiresHistoricalData: /historical|past|history|last|previous|year|month|week/.test(lowerQuery),
    requiresMultipleMarkets: /compare|vs|versus|and|both|multiple/.test(lowerQuery),
  };
}

/**
 * Calculates token cost for a query (1:1 from QT calculatePricing)
 * Uses additive model: totalCost = baseCost + complexityCost + resourceCost
 */
export function calculatePricing(query: string): PricingResult {
  const complexity = analyzeComplexity(query);
  const resources = detectResourceRequirements(query);

  const baseCost = BASE_COST;

  const complexityMultiplier = COMPLEXITY_MULTIPLIERS[complexity];
  const complexityCost = baseCost * (complexityMultiplier - 1);

  let resourceMultiplier = 1;
  if (resources.requiresRealTimeData) {
    resourceMultiplier += RESOURCE_MULTIPLIERS.realTimeData - 1;
  }
  if (resources.requiresHistoricalData) {
    resourceMultiplier += RESOURCE_MULTIPLIERS.historicalData - 1;
  }
  if (resources.requiresMultipleMarkets) {
    resourceMultiplier += RESOURCE_MULTIPLIERS.multipleMarkets - 1;
  }

  const resourceCost = baseCost * (resourceMultiplier - 1);
  const totalCost = Math.ceil(baseCost + complexityCost + resourceCost);

  return {
    baseCost,
    complexityMultiplier,
    resourceMultiplier,
    totalCost,
    breakdown: {
      base: baseCost,
      complexity: complexityCost,
      resources: resourceCost,
    },
  };
}

/**
 * Convenience wrapper that returns the shape expected by the estimate endpoint.
 */
export function detectComplexity(query: string): {
  complexity: ComplexityLevel;
  multipliers: string[];
  tokenAmount: number;
  breakdown: PricingResult["breakdown"];
} {
  const pricing = calculatePricing(query);
  const resources = detectResourceRequirements(query);

  const multipliers: string[] = [];
  if (resources.requiresRealTimeData) multipliers.push("real_time");
  if (resources.requiresHistoricalData) multipliers.push("historical");
  if (resources.requiresMultipleMarkets) multipliers.push("multiple_markets");

  return {
    complexity: analyzeComplexity(query),
    multipliers,
    tokenAmount: pricing.totalCost,
    breakdown: pricing.breakdown,
  };
}

/**
 * USD-based pricing with exponential complexity scaling.
 * Base cost (from env) is multiplied by tier + resource multipliers.
 *
 * Tiers:  simple=1x, medium=3x, complex=10x, very_complex=32x
 * Resources: real-time +50%, historical +30%, multi-market +40% (additive)
 */
export function calculateUsdCost(query: string, baseUsd: number): {
  usdCost: number;
  complexity: ComplexityLevel;
  multipliers: string[];
} {
  const complexity = analyzeComplexity(query);
  const resources = detectResourceRequirements(query);

  const tierMultiplier = USD_COST_TIERS[complexity];

  let resourceMultiplier = 1;
  const multipliers: string[] = [];
  if (resources.requiresRealTimeData) {
    resourceMultiplier += 0.5;
    multipliers.push("real_time");
  }
  if (resources.requiresHistoricalData) {
    resourceMultiplier += 0.3;
    multipliers.push("historical");
  }
  if (resources.requiresMultipleMarkets) {
    resourceMultiplier += 0.4;
    multipliers.push("multiple_markets");
  }

  const usdCost = parseFloat((baseUsd * tierMultiplier * resourceMultiplier).toFixed(2));

  return { usdCost, complexity, multipliers };
}
