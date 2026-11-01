-- Weight tracking: target weight, daily weigh-in reminder time, and logs.
-- One log per day (re-logging upserts). Logs stay private to the member.

alter table profiles add column target_weight_kg numeric(5, 1);
alter table profiles add column weigh_in_time text; -- 'HH:MM' local

create table weight_logs (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references profiles(id) on delete cascade,
  logged_on  date not null,
  weight_kg  numeric(5, 1) not null,
  source     text not null default 'manual', -- manual | reminder
  created_at timestamptz not null default now()
);

create unique index weight_logs_member_day on weight_logs (member_id, logged_on);
create index weight_logs_member_time_idx on weight_logs (member_id, logged_on desc);

alter table weight_logs enable row level security;

create policy "own weight logs" on weight_logs
  for all to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());
