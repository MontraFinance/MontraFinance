const isDev = import.meta.env.DEV;
const TIMEOUT_MS = 8000;

// In dev: Vite proxy rewrites /clawnch-api/* → clawn.ch/api/*
// In prod: Vercel serverless proxy at /api/proxy/clawnch?path=...
function buildUrl(path: string, params?: Record<string, string>): string {
  if (isDev) {
    const qs = params ? '&' + new URLSearchParams(params).toString() : '';
    return `/clawnch-api${path}${qs ? '?' + new URLSearchParams(params).toString() : ''}`;
  }
  const qs = new URLSearchParams({ path, ...params });
  return `/api/proxy/clawnch?${qs.toString()}`;
}

// --- Response types (matching actual API shapes) ---

export interface ClawnchTopToken {
  address: string;
  symbol: string;
  name: string;
  priceUsd: string;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  agent: string;
  clankerUrl: string;
}

export interface ClawnchStats {
  totalMarketCap: number;
  totalVolumeAllTime: number;
  totalVolume24h: number;
  tokenCount: number;
  tokenCount24h: number;
  burnedClawnchFormatted: string;
  topTokens: ClawnchTopToken[];
  agentFeesAllTime: number;
}

export interface ClawnchLaunch {
  contractAddress: string;
  symbol: string;
  name: string;
  agentName: string;
  source: string;
  launchedAt: string;
  clankerUrl: string;
}

interface RawLaunchesResponse {
  launches: ClawnchLaunch[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface ClawnchLaunchesResponse {
  launches: ClawnchLaunch[];
  total: number;
  limit: number;
  offset: number;
}

// --- Fetcher ---

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Public API ---

export async function fetchClawnchStats(): Promise<ClawnchStats | null> {
  return fetchJson<ClawnchStats>(buildUrl('/stats'));
}

export async function fetchClawnchLaunches(
  limit = 20,
  offset = 0,
): Promise<ClawnchLaunchesResponse | null> {
  const raw = await fetchJson<RawLaunchesResponse>(
    buildUrl('/launches', { limit: String(limit), offset: String(offset) }),
  );
  if (!raw) return null;
  return {
    launches: raw.launches,
    total: raw.pagination.total,
    limit: raw.pagination.limit,
    offset: raw.pagination.offset,
  };
}
