-- Pre-approved trade queue for CoW Protocol (Option B)
-- Users queue trades in the UI; a cron gets quotes; users sign when ready.
create table if not exists cow_trade_queue (
  id              uuid primary key default gen_random_uuid(),
  agent_id        text not null,
  owner_address   text not null,
  sell_token      text not null,
  buy_token       text not null,
  sell_amount     numeric not null,
  -- Scheduling: one-shot or recurring
  recurring       boolean not null default false,
  interval_secs   int,              -- e.g. 86400 for daily
  next_run_at     timestamptz not null default now(),
  last_run_at     timestamptz,
  -- Quote data (filled by cron when due)
  quote_buy_amount  numeric,
  quote_fee_amount  numeric,
  quote_valid_to    int,
  quote_data        jsonb,            -- full quote payload for EIP-712 signing
  -- Status lifecycle: queued -> awaiting_signature -> signed -> done / expired / cancelled
  status          text not null default 'queued',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_trade_queue_status on cow_trade_queue(status);
create index if not exists idx_trade_queue_owner on cow_trade_queue(owner_address);
create index if not exists idx_trade_queue_next_run on cow_trade_queue(next_run_at);
