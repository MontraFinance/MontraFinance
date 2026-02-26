-- Farcaster Sentiment Analysis tables
-- Individual cast sentiment records
create table if not exists farcaster_sentiment (
  id          uuid primary key default gen_random_uuid(),
  cast_hash   text not null unique,
  author_fid  bigint,
  author_name text,
  cast_text   text not null,
  score       numeric(4,2) not null,
  likes       int default 0,
  recasts     int default 0,
  analyzed_at timestamptz not null default now()
);

create index if not exists idx_sentiment_score on farcaster_sentiment(score);
create index if not exists idx_sentiment_analyzed on farcaster_sentiment(analyzed_at);

-- Rolling aggregate snapshots (one per cron run)
create table if not exists sentiment_snapshots (
  id             uuid primary key default gen_random_uuid(),
  avg_score      numeric(4,2) not null,
  cast_count     int not null,
  window_minutes int not null default 60,
  created_at     timestamptz not null default now()
);
