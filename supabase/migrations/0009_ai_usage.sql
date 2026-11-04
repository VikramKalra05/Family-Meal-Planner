-- ── AI usage ledger ──────────────────────────────────────────────────────────
-- One row per provider call. Tokens come from the provider's `usage` object
-- when present; otherwise the app stores a character-based estimate and marks
-- the row `estimated = true`. Cost is a historical estimate (or the provider's
-- reported cost, e.g. OpenRouter) and is never recomputed retroactively.

create table if not exists ai_usage_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  provider_id       uuid references ai_providers(id) on delete set null,
  provider_label    text not null,
  model             text not null,
  feature           text not null,
  prompt_tokens     integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  reasoning_tokens  integer check (reasoning_tokens >= 0),
  total_tokens      integer not null default 0 check (total_tokens >= 0),
  estimated         boolean not null default false,
  cost_usd          numeric(14, 8),
  created_at        timestamptz not null default now()
);

create index if not exists ai_usage_user_created_idx
  on ai_usage_events (user_id, created_at desc);
create index if not exists ai_usage_provider_created_idx
  on ai_usage_events (provider_id, created_at desc);

alter table ai_usage_events enable row level security;

-- Immutable ledger: users can read and append their own rows, never rewrite
-- history. Service-role cron/admin work bypasses RLS as usual.
drop policy if exists "read own ai usage" on ai_usage_events;
create policy "read own ai usage" on ai_usage_events
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "insert own ai usage" on ai_usage_events;
create policy "insert own ai usage" on ai_usage_events
  for insert to authenticated
  with check (user_id = auth.uid());
