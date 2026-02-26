-- API Keys table — SHA-256 hashed keys with tier-based rate limiting
CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash      TEXT NOT NULL UNIQUE,
  masked_key    TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT 'Default',
  tier          TEXT NOT NULL DEFAULT 'intelligence' CHECK (tier IN ('intelligence', 'professional', 'enterprise')),
  wallet_address TEXT NOT NULL,
  rate_limit_per_min INTEGER NOT NULL DEFAULT 30,
  monthly_quota INTEGER NOT NULL DEFAULT 10000,
  total_calls   BIGINT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  scopes        TEXT[] NOT NULL DEFAULT '{read}',
  expires_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_wallet ON api_keys (wallet_address);
CREATE INDEX idx_api_keys_hash ON api_keys (key_hash) WHERE is_active = TRUE;
CREATE INDEX idx_api_keys_active ON api_keys (is_active, revoked_at);
