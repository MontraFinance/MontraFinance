-- Farcaster cast log for idempotent autonomous posting
create table farcaster_casts (
  id         uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_key  text not null unique,
  cast_hash  text,
  cast_text  text not null,
  status     text not null default 'pending',
  error      text,
  created_at timestamptz not null default now(),
  posted_at  timestamptz
);

create index farcaster_casts_event_key_idx on farcaster_casts(event_key);
create index farcaster_casts_status_idx on farcaster_casts(status);
