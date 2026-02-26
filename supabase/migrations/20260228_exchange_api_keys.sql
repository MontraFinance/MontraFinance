-- Exchange API Keys: securely stores CEX API credentials (encrypted)
-- for autonomous agent trading on Binance, Coinbase, Bybit, OKX.

CREATE TABLE IF NOT EXISTS exchange_api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  TEXT NOT NULL,
  exchange        TEXT NOT NULL CHECK (exchange IN ('binance', 'coinbase', 'bybit', 'okx')),
  label           TEXT NOT NULL,
  api_key_masked  TEXT NOT NULL,            -- "ABcDe1...xYz9" for display
  encrypted_data  TEXT NOT NULL,            -- AES-256-GCM encrypted JSON: {apiKey, secret, passphrase?}
  permissions     TEXT[] DEFAULT '{}',      -- user-declared: read, trade, withdraw
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exkeys_wallet ON exchange_api_keys(wallet_address);
CREATE INDEX IF NOT EXISTS idx_exkeys_wallet_exchange ON exchange_api_keys(wallet_address, exchange);
CREATE INDEX IF NOT EXISTS idx_exkeys_status ON exchange_api_keys(status) WHERE status = 'active';

-- Link agents to exchange keys (null = on-chain CoW Protocol)
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS exchange_key_id UUID;
