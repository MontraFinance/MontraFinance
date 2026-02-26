-- Smart Accounts — ERC-7579 modular smart account configuration
CREATE TABLE IF NOT EXISTS smart_accounts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address       TEXT NOT NULL UNIQUE,
  smart_account_address TEXT,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'locked', 'frozen')),
  required_signatures  INTEGER NOT NULL DEFAULT 1,
  signers              TEXT[] NOT NULL DEFAULT '{}',
  guardrails           JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_smart_accounts_wallet ON smart_accounts (wallet_address);

-- Smart Account Modules — installed ERC-7579 modules
CREATE TABLE IF NOT EXISTS smart_account_modules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_account_id  UUID NOT NULL REFERENCES smart_accounts(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('validator', 'executor', 'hook', 'fallback')),
  address           TEXT NOT NULL,
  is_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  config            JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sa_modules_account ON smart_account_modules (smart_account_id);

-- Session Keys — delegated access keys
CREATE TABLE IF NOT EXISTS smart_account_session_keys (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_account_id  UUID NOT NULL REFERENCES smart_accounts(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  public_key        TEXT NOT NULL,
  permissions       TEXT[] NOT NULL DEFAULT '{view_only}',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sa_session_keys_account ON smart_account_session_keys (smart_account_id);

-- Spending Limits — per-token spending constraints
CREATE TABLE IF NOT EXISTS smart_account_spending_limits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_account_id  UUID NOT NULL REFERENCES smart_accounts(id) ON DELETE CASCADE,
  token             TEXT NOT NULL,
  daily_limit       NUMERIC NOT NULL DEFAULT 0,
  weekly_limit      NUMERIC NOT NULL DEFAULT 0,
  per_tx_limit      NUMERIC NOT NULL DEFAULT 0,
  used_today        NUMERIC NOT NULL DEFAULT 0,
  used_this_week    NUMERIC NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sa_spending_account ON smart_account_spending_limits (smart_account_id);
