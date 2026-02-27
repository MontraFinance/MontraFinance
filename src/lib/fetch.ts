/**
 * Fetch wrapper with built-in timeout (default 10s).
 * Uses AbortSignal.timeout() for clean cancellation.
 */
export function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const signal = AbortSignal.timeout(timeoutMs);
  return fetch(url, { ...options, signal });
}
