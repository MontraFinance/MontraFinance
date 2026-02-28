/**
 * Sentiment scoring engine for Farcaster casts
 * Pure functions, no side effects.
 */

const POSITIVE_WORDS = new Set([
  "bullish", "moon", "pump", "buy", "alpha", "gem", "based", "fire",
  "lfg", "wagmi", "up", "gain", "profit", "rocket", "breakout",
  "strong", "growth", "rally", "surge", "win", "amazing", "great",
  "love", "excellent", "impressive", "massive", "epic", "join",
  "undervalued", "opportunity", "early",
]);

const NEGATIVE_WORDS = new Set([
  "bearish", "dump", "sell", "rug", "scam", "dead", "rekt", "ngmi",
  "fade", "crash", "loss", "down", "tank", "drop", "plunge",
  "weak", "fear", "panic", "bad", "terrible", "worst", "avoid",
  "fake", "fraud", "ponzi", "warning",
]);

/** Words that negate the next sentiment word */
const NEGATION_WORDS = new Set([
  "stop", "dont", "don't", "no", "never", "not", "without",
  "quit", "avoid", "preventing", "prevent", "end", "enough",
]);

/** Positive phrases scored as a unit (checked before word-level) */
const POSITIVE_PHRASES = [
  "come to", "check out", "look into", "get into", "move to",
  "switch to", "try out", "hop on", "get on", "still early",
  "don't miss", "dont miss", "stop getting rug", "stop getting rugged",
  "tired of rug", "tired of getting rug", "no more rug",
];

/** Negative phrases scored as a unit */
const NEGATIVE_PHRASES = [
  "stay away", "don't buy", "dont buy", "going to zero",
  "about to dump", "exit scam",
];

/**
 * Score a single cast's sentiment.
 * Returns a value between -1.0 and +1.0
 */
export function scoreCast(
  text: string,
  likes: number = 0,
  recasts: number = 0,
): number {
  const lower = text.toLowerCase();
  const cleaned = lower.replace(/[^a-z0-9\s']/g, "");
  const words = cleaned.split(/\s+/);

  let positive = 0;
  let negative = 0;

  // 1. Check phrase-level sentiment first
  for (const phrase of POSITIVE_PHRASES) {
    if (lower.includes(phrase)) positive++;
  }
  for (const phrase of NEGATIVE_PHRASES) {
    if (lower.includes(phrase)) negative++;
  }

  // 2. Word-level sentiment with negation awareness
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = i > 0 ? words[i - 1] : "";
    const isNegated = NEGATION_WORDS.has(prevWord);

    if (POSITIVE_WORDS.has(word)) {
      if (isNegated) { negative++; } else { positive++; }
    } else if (NEGATIVE_WORDS.has(word)) {
      if (isNegated) { positive++; } else { negative++; }
    }
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
