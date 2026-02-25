const TIMEOUT_MS = 8000;

// ── Response types ──

export interface RevenueStats {
  totalRevenue: number;
  revenue24h: number;
  revenue7d: number;
  revenue30d: number;
  totalPayments: number;
  avgPayment: number;
  uniquePayers: number;
  byEndpoint: Array<{ endpoint: string; total: number; count: number }>;
  dailyRevenue: Array<{ date: string; revenue: number; count: number }>;
  recentPayments: Array<{
    payer: string;
    endpoint: string;
    amountUsdc: number;
    tierDiscount: number;
    time: string;
  }>;
  buyback: {
    totalUsdcBoughtBack: number;
    totalMontraBurned: number;
    totalOrders: number;
  };
}

// ── Fetcher ──

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Public API ──

export async function fetchRevenueStats(): Promise<RevenueStats | null> {
  return fetchJson<RevenueStats>('/api/revenue/stats');
}
