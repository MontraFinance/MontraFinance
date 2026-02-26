-- Deduplication table for proactive XMTP alerts (mirrors farcaster_casts pattern)
CREATE TABLE IF NOT EXISTS xmtp_alerts_sent (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key  text UNIQUE NOT NULL,
  event_type text NOT NULL,
  agent_id   text,
  sent_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xmtp_alerts_event_key ON xmtp_alerts_sent(event_key);
