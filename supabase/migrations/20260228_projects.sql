-- Projects table for Manage Project feature
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  profile jsonb not null default '{}',
  snapshot jsonb,
  ai_diagnosis jsonb,
  token_metrics jsonb,
  checklist jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_user_id on projects (user_id);
create index if not exists idx_projects_updated_at on projects (updated_at desc);
