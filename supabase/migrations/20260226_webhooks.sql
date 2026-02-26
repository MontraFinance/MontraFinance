-- Webhooks — event delivery to external endpoints
CREATE TABLE IF NOT EXISTS webhooks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  url            TEXT NOT NULL,
  secret         TEXT NOT NULL,
  events         TEXT[] NOT NULL DEFAULT '{agent.status,trade.executed,burn.completed}',
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  failures       INTEGER NOT NULL DEFAULT 0,
  last_triggered TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhooks_wallet ON webhooks (wallet_address);
CREATE INDEX idx_webhooks_active ON webhooks (is_active) WHERE is_active = TRUE;

-- Webhook delivery log
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id  UUID NOT NULL REFERENCES webhooks(id),
  event       TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  status_code INTEGER,
  response    TEXT,
  success     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wh_deliveries_webhook ON webhook_deliveries (webhook_id);
CREATE INDEX idx_wh_deliveries_created ON webhook_deliveries (created_at DESC);
