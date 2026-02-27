-- Holders group chat messages (token-gated community chatroom)
create table if not exists holders_chat_messages (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  content text not null,
  tier text not null default 'bronze',
  created_at timestamptz not null default now()
);

-- Primary query: fetch recent messages ordered by time
create index holders_chat_created_idx on holders_chat_messages(created_at desc);

-- Per-wallet lookups and rate-limit queries
create index holders_chat_wallet_idx on holders_chat_messages(wallet_address, created_at desc);
