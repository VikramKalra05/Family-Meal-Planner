-- Web Push: browser push subscriptions + a server-side delivery log.
-- One row per browser/device; a member may have several (phone + laptop).

create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_member_idx on push_subscriptions (member_id);

alter table push_subscriptions enable row level security;

create policy "own push subscriptions select" on push_subscriptions
  for select to authenticated
  using (member_id = auth.uid());

create policy "own push subscriptions insert" on push_subscriptions
  for insert to authenticated
  with check (member_id = auth.uid());

create policy "own push subscriptions update" on push_subscriptions
  for update to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

create policy "own push subscriptions delete" on push_subscriptions
  for delete to authenticated
  using (member_id = auth.uid());

-- Delivery log: written by the push scheduler via the service role (RLS
-- blocks client inserts), readable by the member so the UI can show
-- "last notified at". Backs the max-2-per-day / 4h-apart cadence.
create table push_log (
  id        uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles(id) on delete cascade,
  kind      text not null,            -- 'weigh-in'
  day       date not null,            -- IST day the notification belongs to
  sent_at   timestamptz not null default now()
);

create index push_log_member_kind_day on push_log (member_id, kind, day);

alter table push_log enable row level security;

create policy "own push log select" on push_log
  for select to authenticated
  using (member_id = auth.uid());
