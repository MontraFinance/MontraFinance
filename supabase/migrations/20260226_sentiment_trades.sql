-- Sentiment-triggered USDC -> MONTRA trades via CoW Protocol
-- When Farcaster community sentiment crosses a bullish threshold,
-- the system auto-buys MONTRA and posts the trade back to Farcaster.

create table if not exists sentiment_trades (
  id                  uuid primary key default gen_random_uuid(),
  order_uid           text unique,
  sentiment_score     numeric(4,2) not null,
  usdc_amount         numeric(18,6) not null,
  montra_amount       numeric,
  status              text not null default 'pending',
  trigger_snapshot_id uuid,
  cow_quote_data      jsonb,
  farcaster_cast_hash text,
  error_message       text,
  created_at          timestamptz not null default now(),
  filled_at           timestamptz
);

create index if not exists idx_sentiment_trades_status on sentiment_trades(status);
create index if not exists idx_sentiment_trades_created on sentiment_trades(created_at desc);
