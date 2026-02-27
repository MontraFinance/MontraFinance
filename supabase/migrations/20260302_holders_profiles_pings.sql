-- Holders display name profiles
create table if not exists holders_profiles (
  wallet_address text primary key,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index holders_profiles_name_lower_idx
  on holders_profiles (lower(display_name));

-- Ping / @mention notifications
create table if not exists holders_pings (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references holders_chat_messages(id) on delete cascade,
  from_wallet text not null,
  to_wallet text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index holders_pings_to_wallet_idx
  on holders_pings (to_wallet, read, created_at desc);
