-- XMTP messaging subscriptions
create table if not exists xmtp_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  wallet_address  text not null,
  agent_id        text not null,
  alert_types     text[] not null default '{trade,milestone,burn}',
  enabled         boolean not null default true,
  created_at      timestamptz not null default now(),
  unique(wallet_address, agent_id)
);

create index if not exists idx_xmtp_wallet on xmtp_subscriptions(wallet_address);
create index if not exists idx_xmtp_agent on xmtp_subscriptions(agent_id);
