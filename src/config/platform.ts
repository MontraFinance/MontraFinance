/**
 * Platform configuration — single source of truth for infrastructure specs.
 * Update these values when hardware, models, or MCP tools change.
 * Dashboard and other UI components pull from here instead of hardcoding.
 */

// ── GPU Cluster ──
export const GPU_CONFIG = {
  model: "RTX 5090",
  count: 4,
  totalVram: 128, // GB
  label: `4× RTX 5090 · 128 GB VRAM`,
  provider: "Vast.ai",
  tensorParallel: 4,
} as const;

// ── CPU ──
export const CPU_CONFIG = {
  model: "AMD Thread-ripper",
  cores: 16,
  threads: 32,
} as const;

// ── AI Models ──
export const AI_MODELS = [
  { name: "MONTRA-32B",    sub: "Risk Intelligence", metricLabel: "Inference", metricKey: "tradingInference" as const, unit: "ms" },
  { name: "MONTRA-MERGED", sub: "Qwen2.5 + LoRA",   metricLabel: "Status",    metricKey: null,                       unit: "",   staticValue: "Active" },
  { name: "CONSENSUS",     sub: "5 models - AGG",    metricLabel: "Accuracy",  metricKey: "consensusAccuracy" as const, unit: "%" },
] as const;

// ── MCP Server ──
export const MCP_CONFIG = {
  version: "2.1.0",
  toolCount: 86,
  resourceCount: 8,
  promptCount: 10,
} as const;

// ── Database ──
export const DB_CONFIG = {
  engine: "ClickHouse",
} as const;
