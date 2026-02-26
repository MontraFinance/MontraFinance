-- LP fee claim history from Clawncher-deployed tokens.
-- The fee-harvester cron periodically claims accumulated trading fees
-- from Uniswap V4 pools and routes them to the treasury wallet.

create table if not exists fee_claims (
  id                uuid primary key default gen_random_uuid(),
  token_address     text not null,
  token_symbol      text,
  amount_weth       numeric(30,18) not null default 0,
  tx_hash           text,
  status            text not null default 'pending',
  error_message     text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_fee_claims_token on fee_claims(token_address);
