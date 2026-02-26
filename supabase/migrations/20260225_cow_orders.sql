-- CoW Protocol order tracking
create table if not exists cow_orders (
  id                uuid primary key default gen_random_uuid(),
  agent_id          text not null,
  order_uid         text unique,
  sell_token        text not null,
  buy_token         text not null,
  sell_amount       numeric not null,
  buy_amount_min    numeric,
  buy_amount_actual numeric,
  status            text not null default 'pending',
  savings_usd       numeric,
  created_at        timestamptz not null default now(),
  filled_at         timestamptz,
  expires_at        timestamptz
);

create index if not exists idx_cow_status on cow_orders(status);
create index if not exists idx_cow_agent on cow_orders(agent_id);
