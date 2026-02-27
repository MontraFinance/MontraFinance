-- Agent Mode: trading vs monitor
-- Trading agents execute trades, monitor agents provide AI analysis + XMTP alerts only
ALTER TABLE agents ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'trading';

CREATE INDEX IF NOT EXISTS idx_agents_mode ON agents(mode);

COMMENT ON COLUMN agents.mode IS 'trading = executes trades, monitor = AI analysis + XMTP alerts only';
