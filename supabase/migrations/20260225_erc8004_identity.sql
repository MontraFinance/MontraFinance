-- ERC-8004 Agent Identity columns on agents table
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS erc8004_agent_id       bigint          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS erc8004_tx_hash        text            DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS erc8004_registered_at  timestamptz     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS erc8004_agent_uri      text            DEFAULT NULL;

CREATE INDEX IF NOT EXISTS agents_erc8004_agent_id_idx
  ON agents(erc8004_agent_id) WHERE erc8004_agent_id IS NOT NULL;

-- Reputation cache (avoids on-chain reads on every page load)
CREATE TABLE IF NOT EXISTS agent_reputation (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         text NOT NULL,
  erc8004_agent_id bigint NOT NULL,
  feedback_count   integer NOT NULL DEFAULT 0,
  avg_score        numeric(10,4) DEFAULT NULL,
  last_synced_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id)
);

CREATE INDEX IF NOT EXISTS agent_reputation_erc8004_id_idx
  ON agent_reputation(erc8004_agent_id);
