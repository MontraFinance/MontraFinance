-- Trade Outcome Scoring: adds columns to track whether AI recommendations
-- were profitable, enabling adaptive learning via prompt feedback.

-- ── Scoring columns on agent_ai_consultations ──
ALTER TABLE agent_ai_consultations
  ADD COLUMN IF NOT EXISTS outcome_pnl_usd     NUMERIC,         -- realized P&L in USD
  ADD COLUMN IF NOT EXISTS outcome_pnl_pct     NUMERIC,         -- P&L as percentage
  ADD COLUMN IF NOT EXISTS outcome_scored      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS outcome_scored_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS was_correct         BOOLEAN,         -- true if recommendation was profitable / accurate
  ADD COLUMN IF NOT EXISTS entry_price_usd     NUMERIC,         -- ETH/USD at time of trade fill
  ADD COLUMN IF NOT EXISTS scored_price_usd    NUMERIC,         -- ETH/USD at time of scoring
  ADD COLUMN IF NOT EXISTS confidence_at_rec   INT;             -- original AI confidence (cached for scoring)

CREATE INDEX IF NOT EXISTS idx_ai_consult_unscored
  ON agent_ai_consultations(agent_id, outcome_scored)
  WHERE outcome_scored = FALSE AND trade_queued = TRUE;

-- ── Link trade queue entries back to the consultation that spawned them ──
ALTER TABLE cow_trade_queue
  ADD COLUMN IF NOT EXISTS consultation_id UUID;

CREATE INDEX IF NOT EXISTS idx_trade_queue_consultation
  ON cow_trade_queue(consultation_id)
  WHERE consultation_id IS NOT NULL;

-- ── Agent-level performance tracking ──
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS ai_win_rate        NUMERIC DEFAULT 0,   -- % of correct AI recommendations
  ADD COLUMN IF NOT EXISTS ai_total_scored    INT DEFAULT 0,        -- total scored consultations
  ADD COLUMN IF NOT EXISTS ai_streak          INT DEFAULT 0;        -- current win/loss streak (+N wins, -N losses)
