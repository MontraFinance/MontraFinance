-- Agent AI Consultations: logs each time an agent consults the Montra AI model.
-- Used by both the agent-ai-checkin cron and the consult_ai_for_agent MCP tool.

CREATE TABLE IF NOT EXISTS agent_ai_consultations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          TEXT NOT NULL,
  query_text        TEXT NOT NULL,
  ai_response       TEXT,
  recommendation    TEXT,          -- 'buy' | 'sell' | 'hold'
  burn_tx_hash      TEXT,
  burn_amount       NUMERIC,
  model_used        TEXT NOT NULL DEFAULT 'qwen3:14b',
  source            TEXT NOT NULL DEFAULT 'cron',  -- 'cron' or 'mcp'
  trade_queued      BOOLEAN NOT NULL DEFAULT FALSE,
  trade_queue_id    UUID,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_consult_agent ON agent_ai_consultations(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_consult_created ON agent_ai_consultations(created_at DESC);

-- ── agents table additions ──
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS last_ai_consultation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_consultation_count INT NOT NULL DEFAULT 0;
