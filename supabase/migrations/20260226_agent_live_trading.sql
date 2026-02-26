-- Agent Live Trading: add real wallet, API key, and trading status columns
-- to agents and cow_trade_queue tables.

-- ── agents table additions ──
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES api_keys(id),
  ADD COLUMN IF NOT EXISTS agent_wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS agent_wallet_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS funding_tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS funding_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trading_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key_id);
CREATE INDEX IF NOT EXISTS idx_agents_trading ON agents(trading_enabled) WHERE trading_enabled = TRUE;

-- ── cow_trade_queue additions ──
ALTER TABLE cow_trade_queue
  ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES api_keys(id);

-- ── Add new statuses to trade queue lifecycle ──
-- Status lifecycle: queued -> quoted -> signed -> submitted -> filled / expired / cancelled
COMMENT ON COLUMN cow_trade_queue.status IS 'queued -> quoted -> signed -> submitted -> filled / expired / cancelled';
