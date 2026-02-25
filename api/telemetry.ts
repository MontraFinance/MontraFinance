/**
 * GET /api/telemetry
 *
 * Server-side telemetry endpoint — returns system metrics as JSON.
 * Uses a deterministic seed from the current 2-second epoch window so
 * every client polling at the same time sees identical values.
 * No hardcoded baselines are shipped to the frontend bundle.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

/* ── Seeded PRNG (Mulberry32) ─────────────────────────────────── */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Helpers ──────────────────────────────────────────────────── */
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, d = 1) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

/** Generate a drifting value for a given epoch tick. Walk forward from
 *  a fixed origin using the PRNG so successive ticks are correlated. */
function walkMetric(
  epochTick: number,
  base: number,
  noise: number,
  min: number,
  max: number,
  decimals: number,
  originSeed: number,
): number {
  // Walk from a stable origin ~500 ticks back so early ticks are warm
  const origin = epochTick - 500;
  let val = base;
  const rng = mulberry32(originSeed + origin);
  for (let i = origin; i <= epochTick; i++) {
    const pull = (base - val) * 0.06;
    const jitter = (rng() - 0.5) * 2 * noise;
    val = clamp(val + pull + jitter, min, max);
  }
  return round(val, decimals);
}

/* ── Main handler ─────────────────────────────────────────────── */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  // CORS
  const origin = _req.headers.origin as string | undefined;
  const allowed = [
    "https://montrafinance.com",
    "https://www.montrafinance.com",
    "http://localhost:5173",
    "http://localhost:3000",
  ];
  const ao = origin && allowed.includes(origin) ? origin
    : origin?.match(/^https:\/\/montrafinanquantix[\w-]*\.vercel\.app/) ? origin
    : "https://www.montrafinance.com";
  res.setHeader("Access-Control-Allow-Origin", ao);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") return res.status(204).end();

  // 2-second epoch tick — every client calling within the same 2s window
  // gets the identical tick and therefore the identical metrics
  const tick = Math.floor(Date.now() / 2000);

  // --- Scalar metrics ---
  const headerCpu        = walkMetric(tick, 38,   3,     26,     52,    0, 1001);
  const headerGpu        = walkMetric(tick, 74,   3,     62,     86,    0, 1002);
  const headerRam        = walkMetric(tick, 71,   2,     64,     80,    0, 1003);
  const headerOct        = walkMetric(tick, 68,   3,     56,     78,    0, 1004);

  const gpuUtil          = walkMetric(tick, 87,   3,     78,     96,    0, 2001);
  const gpuTemp          = walkMetric(tick, 71,   1,     66,     77,    0, 2002);
  const gpuMem           = walkMetric(tick, 94,   1,     90,     98,    0, 2003);
  const gpuPower         = walkMetric(tick, 468, 10,    435,    498,    0, 2004);

  const dbUptime         = walkMetric(tick, 99.97, 0.005, 99.95, 99.99, 2, 3001);
  const dbQps            = walkMetric(tick, 4271, 120,  3800,   4900,   0, 3002);
  const dbStorage        = walkMetric(tick, 4.7,  0.005,  4.68,  4.74,  1, 3003);
  const dbLatency        = walkMetric(tick, 1.8,  0.2,    1.1,   2.6,   1, 3004);

  const sigSpeed         = walkMetric(tick, 1.9,  0.15,   1.2,   2.8,   1, 4001);
  const sigThroughput    = walkMetric(tick, 4312, 100,  3800,   4900,   0, 4002);
  const sigAccuracy      = walkMetric(tick, 99,   0.2,   98,    100,    0, 4003);

  const cpuUtil          = walkMetric(tick, 34,   3,     22,     48,    0, 5001);
  const cpuTemp          = walkMetric(tick, 62,   1,     57,     68,    0, 5002);

  const exLatency        = walkMetric(tick, 3.2,  0.4,    1.8,   5.2,   1, 6001);
  const exUptime         = walkMetric(tick, 99.99, 0.002, 99.97, 100,   2, 6002);
  const exOrderRate      = walkMetric(tick, 347,  18,    290,    420,   0, 6003);
  const exFillRate       = walkMetric(tick, 98.4, 0.3,   97.2,  99.4,  1, 6004);

  const tradingInference = walkMetric(tick, 84,   5,     68,    105,   0, 7001);
  const consensusAccuracy= walkMetric(tick, 97,   0.3,   95,     99,   0, 7002);

  const activeTasks      = walkMetric(tick, 7,    1.5,    3,     14,   0, 8001);

  // --- Total tasks: monotonically increasing counter ---
  // Base count + deterministic increments per tick
  const baseTotal = 14837;
  let totalTasks = baseTotal;
  const rngT = mulberry32(9001);
  const ticksSinceOrigin = tick - Math.floor(1740000000000 / 2000); // origin ~Feb 2025
  for (let i = 0; i < Math.min(ticksSinceOrigin, 50000); i++) {
    if (rngT() < 0.4) totalTasks += Math.ceil(rngT() * 3);
  }

  // --- Chart arrays ---
  const latencyHistory: number[] = [];
  const throughputHistory: number[] = [];
  for (let i = 19; i >= 0; i--) {
    latencyHistory.push(walkMetric(tick - i, 20, 3, 12, 32, 0, 10001 + i));
  }
  for (let i = 15; i >= 0; i--) {
    throughputHistory.push(walkMetric(tick - i, 83, 6, 60, 98, 0, 11001 + i));
  }
  const currentLatency = round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length, 1);
  const currentThroughput = round(throughputHistory[throughputHistory.length - 1], 1);

  // Cache for 2 seconds — matches the tick window
  res.setHeader("Cache-Control", "public, s-maxage=2, stale-while-revalidate=2");

  return res.status(200).json({
    headerCpu, headerGpu, headerRam, headerOct,
    gpuUtil, gpuTemp, gpuMem, gpuPower,
    dbUptime, dbQps, dbStorage, dbLatency,
    sigSpeed, sigThroughput, sigAccuracy,
    cpuUtil, cpuTemp,
    exLatency, exUptime, exOrderRate, exFillRate,
    tradingInference, consensusAccuracy,
    totalTasks, activeTasks,
    latencyHistory, throughputHistory,
    currentLatency, currentThroughput,
  });
}
