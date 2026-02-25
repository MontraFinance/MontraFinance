import { useState, useEffect, useCallback } from 'react';
import { fetchRevenueStats, type RevenueStats } from '../services/revenueApi';

const EMPTY: RevenueStats = {
  totalRevenue: 0,
  revenue24h: 0,
  revenue7d: 0,
  revenue30d: 0,
  totalPayments: 0,
  avgPayment: 0,
  uniquePayers: 0,
  byEndpoint: [],
  dailyRevenue: [],
  recentPayments: [],
  buyback: { totalUsdcBoughtBack: 0, totalMontraBurned: 0, totalOrders: 0 },
};

export function useRevenue(intervalMs = 30_000) {
  const [data, setData] = useState<RevenueStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    const result = await fetchRevenueStats();
    if (result) {
      setData(result);
      setError(false);
    } else {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { data, loading, error, refresh };
}
