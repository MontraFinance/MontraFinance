-- x402 payment tracking for revenue analytics
create table if not exists x402_payments (
  id              uuid primary key default gen_random_uuid(),
  payer_address   text not null,
  endpoint        text not null,
  amount_usdc     numeric(18,6) not null,
  amount_raw      text not null,
  tier_discount   numeric(5,2) default 0,
  resource        text,
  description     text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_x402_payer on x402_payments(payer_address);
create index if not exists idx_x402_endpoint on x402_payments(endpoint);
create index if not exists idx_x402_created on x402_payments(created_at desc);
