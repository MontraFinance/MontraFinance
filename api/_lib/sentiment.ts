/**
 * Sentiment scoring engine for Farcaster casts
 * Pure functions, no side effects.
 */

const POSITIVE_WORDS = new Set([
  "bullish", "moon", "pump", "buy", "alpha", "gem", "based", "fire",
  "lfg", "wagmi", "up", "gain", "profit", "rocket", "breakout",
  "strong", "growth", "rally", "surge", "win", "amazing", "great",
  "love", "excellent", "impressive", "massive", "epic",
]);

const NEGATIVE_WORDS = new Set([
  "bearish", "dump", "sell", "rug", "scam", "dead", "rekt", "ngmi",
  "fade", "crash", "loss", "down", "tank", "drop", "plunge",
  "weak", "fear", "panic", "bad", "terrible", "worst", "avoid",
  "fake", "fraud", "ponzi", "warning",
]);

/**
 * Score a single cast's sentiment.
 * Returns a value between -1.0 and +1.0
 */
export function scoreCast(
  text: string,
  likes: number = 0,
  recasts: number = 0,
): number {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);

  let positive = 0;
  let negative = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) positive++;
    if (NEGATIVE_WORDS.has(word)) negative++;
  }

  const total = positive + negative;
  if (total === 0) return 0;

  // Raw score from -1 to +1
  let raw = (positive - negative) / total;

  // Engagement multiplier — highly-engaged casts amplify the signal
  const engagement = (likes + recasts) * 0.02;
  raw = raw > 0 ? raw + engagement : raw - engagement;

  // Clamp to [-1, 1]
  return Math.max(-1, Math.min(1, Math.round(raw * 100) / 100));
}

/**
 * Compute average sentiment from an array of scores
 */
export function averageSentiment(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 100) / 100;
}
