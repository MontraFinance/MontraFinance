-- Audit trail — compliance log for all significant actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  action         TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  description    TEXT NOT NULL,
  metadata       JSONB NOT NULL DEFAULT '{}',
  ip_address     TEXT,
  tx_hash        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_wallet ON audit_logs (wallet_address);
CREATE INDEX idx_audit_action ON audit_logs (action);
CREATE INDEX idx_audit_severity ON audit_logs (severity);
CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);
