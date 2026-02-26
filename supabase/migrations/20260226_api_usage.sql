-- API Usage tracking — per-call metering for billing and analytics
CREATE TABLE IF NOT EXISTS api_usage (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id     UUID NOT NULL REFERENCES api_keys(id),
  wallet_address TEXT NOT NULL,
  tool           TEXT NOT NULL,
  status_code    INTEGER NOT NULL,
  latency_ms     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_usage_key ON api_usage (api_key_id);
CREATE INDEX idx_api_usage_wallet ON api_usage (wallet_address);
CREATE INDEX idx_api_usage_created ON api_usage (created_at DESC);
CREATE INDEX idx_api_usage_tool ON api_usage (tool);

-- Daily rollup view for chart data
CREATE OR REPLACE VIEW api_usage_daily AS
SELECT
  wallet_address,
  DATE(created_at) AS day,
  COUNT(*) AS calls,
  AVG(latency_ms)::INTEGER AS avg_latency,
  COUNT(*) FILTER (WHERE status_code >= 400) AS errors
FROM api_usage
GROUP BY wallet_address, DATE(created_at);
