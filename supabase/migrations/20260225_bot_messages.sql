-- Bot chat messages (replaces XMTP for agent bot conversations)
create table if not exists bot_messages (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  agent_id text,
  sender text not null check (sender in ('user', 'bot')),
  content text not null,
  created_at timestamptz not null default now()
);

create index bot_messages_wallet_idx on bot_messages(wallet_address, agent_id, created_at);
