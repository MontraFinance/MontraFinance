/**
 * Simple in-memory rate limiter for Vercel serverless functions.
 * Resets on cold start (acceptable for Vercel).
 */

const store = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  ip: string,
  limit: number,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

/** Clean up expired entries (call periodically or on each request) */
export function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}
