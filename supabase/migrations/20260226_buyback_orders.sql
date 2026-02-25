-- Automated USDC -> MONTRA buyback orders via CoW Protocol
create table if not exists buyback_orders (
  id                uuid primary key default gen_random_uuid(),
  order_uid         text unique,
  usdc_amount       numeric(18,6) not null,
  montra_amount     numeric,
  montra_burned     numeric default 0,
  burn_tx_hash      text,
  status            text not null default 'pending',
  trigger_balance   numeric(18,6),
  cow_quote_data    jsonb,
  savings_usd       numeric,
  error_message     text,
  created_at        timestamptz not null default now(),
  filled_at         timestamptz,
  burned_at         timestamptz
);

create index if not exists idx_buyback_status on buyback_orders(status);
create index if not exists idx_buyback_created on buyback_orders(created_at desc);
