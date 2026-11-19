-- Gym module: equipment-aware setup, programs, offline-friendly logging,
-- measurements, progress photos and the weekly adaptation ledger.
--
-- Design notes:
--  * Seed exercises live in code (`src/data/seed-exercises.ts`) and are
--    referenced by a stable text key (`seed:bench-press`). This keeps the
--    library offline and avoids a seed migration. Only user-created exercises
--    are stored, in `custom_exercises`.
--  * `set_logs` stores canonical kg plus the display unit and a plate
--    snapshot, so history stays truthful when the gym inventory is edited.
--  * Client-generated ids make the offline queue idempotent.

-- ── Gym profile ─────────────────────────────────────────────────────────────
create table if not exists gyms (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references profiles(id) on delete cascade,
  name            text not null default 'My gym',
  unit            text not null default 'kg' check (unit in ('kg', 'lb')),
  bar_weight      numeric(5, 2) not null default 20,
  plate_inventory jsonb not null default '[]',
  bars            jsonb not null default '[]',
  machine_stacks  jsonb not null default '[]',
  equipment_ids   text[] not null default '{}',
  training_days   smallint[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (member_id)
);

-- ── Custom exercises (seed library is code) ─────────────────────────────────
create table if not exists custom_exercises (
  id                 uuid primary key default gen_random_uuid(),
  member_id          uuid not null references profiles(id) on delete cascade,
  name               text not null,
  aliases            text[] not null default '{}',
  primary_muscle     text not null,
  secondary_muscles  text[] not null default '{}',
  equipment          text not null,
  pattern            text not null,
  is_unilateral      boolean not null default false,
  instructions       text,
  tips               text,
  media              jsonb not null default '[]',
  created_at         timestamptz not null default now()
);
create index if not exists custom_exercises_member on custom_exercises (member_id);

-- ── Programs ────────────────────────────────────────────────────────────────
create table if not exists programs (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references profiles(id) on delete cascade,
  name         text not null,
  template     text not null default 'custom',
  days_per_week smallint not null default 3 check (days_per_week between 1 and 7),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists programs_one_active on programs (member_id) where is_active;

create table if not exists program_days (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references programs(id) on delete cascade,
  day_index   smallint not null check (day_index between 0 and 6),
  name        text not null,
  focus       text[] not null default '{}',
  unique (program_id, day_index)
);

create table if not exists program_exercises (
  id            uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references program_days(id) on delete cascade,
  exercise_key  text not null,
  position      smallint not null default 0,
  target_sets   smallint not null default 3 check (target_sets between 1 and 10),
  rep_min       smallint not null default 8 check (rep_min between 1 and 30),
  rep_max       smallint not null default 12 check (rep_max between 1 and 30),
  rest_seconds  smallint not null default 90,
  increment_kg  numeric(5, 2) not null default 2.5,
  notes         text
);
create index if not exists program_exercises_day on program_exercises (program_day_id, position);

-- ── Sessions + set logs ─────────────────────────────────────────────────────
create table if not exists workout_sessions (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null references profiles(id) on delete cascade,
  program_day_id    uuid references program_days(id) on delete set null,
  session_date      date not null,
  status            text not null default 'in_progress' check (status in ('in_progress', 'completed', 'skipped')),
  readiness         jsonb,
  notes             text,
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  client_updated_at timestamptz not null default now(),
  created_at        timestamptz not null default now()
);
create index if not exists workout_sessions_member_date on workout_sessions (member_id, session_date desc);

create table if not exists set_logs (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references workout_sessions(id) on delete cascade,
  member_id         uuid not null references profiles(id) on delete cascade,
  exercise_key      text not null,
  set_index         smallint not null default 0,
  weight_kg         numeric(6, 2) not null default 0,
  display_weight    numeric(6, 2),
  display_unit      text not null default 'kg' check (display_unit in ('kg', 'lb')),
  plates            jsonb,
  stack_position    smallint,
  reps              smallint not null default 0 check (reps >= 0),
  rpe               numeric(3, 1) check (rpe is null or (rpe >= 1 and rpe <= 10)),
  is_warmup         boolean not null default false,
  is_pr             boolean not null default false,
  notes             text,
  client_updated_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index if not exists set_logs_session on set_logs (session_id, exercise_key, set_index);
create index if not exists set_logs_member on set_logs (member_id, created_at desc);
create index if not exists set_logs_exercise on set_logs (member_id, exercise_key, created_at desc);

-- ── Body measurements + photos ──────────────────────────────────────────────
create table if not exists body_measurements (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references profiles(id) on delete cascade,
  measured_on date not null,
  waist_cm    numeric(5, 1),
  chest_cm    numeric(5, 1),
  arm_cm      numeric(5, 1),
  thigh_cm    numeric(5, 1),
  hip_cm      numeric(5, 1),
  neck_cm     numeric(5, 1),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (member_id, measured_on)
);

create table if not exists progress_photos (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references profiles(id) on delete cascade,
  taken_on     date not null,
  storage_path text not null,
  pose         text not null default 'front' check (pose in ('front', 'side', 'back')),
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists progress_photos_member on progress_photos (member_id, taken_on desc);

-- Private bucket. Path convention: <member_id>/<uuid>.jpg
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

-- ── Adaptations + streak freezes ────────────────────────────────────────────
create table if not exists adaptive_adjustments (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references profiles(id) on delete cascade,
  effective_on date not null,
  delta_kcal   integer not null,
  total_kcal   integer not null,
  reason       text not null,
  signals      jsonb not null default '{}',
  applied_at   timestamptz not null default now()
);
create index if not exists adaptive_adjustments_member on adaptive_adjustments (member_id, effective_on desc);

create table if not exists streak_freezes (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references profiles(id) on delete cascade,
  used_on    date not null,
  note       text,
  created_at timestamptz not null default now(),
  unique (member_id, used_on)
);

alter table profiles add column if not exists calorie_adjustment_kcal integer not null default 0;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table gyms enable row level security;
alter table custom_exercises enable row level security;
alter table programs enable row level security;
alter table program_days enable row level security;
alter table program_exercises enable row level security;
alter table workout_sessions enable row level security;
alter table set_logs enable row level security;
alter table body_measurements enable row level security;
alter table progress_photos enable row level security;
alter table adaptive_adjustments enable row level security;
alter table streak_freezes enable row level security;

drop policy if exists "own gym" on gyms;
create policy "own gym" on gyms
  for all to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists "own custom exercises" on custom_exercises;
create policy "own custom exercises" on custom_exercises
  for all to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists "own programs" on programs;
create policy "own programs" on programs
  for all to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists "own program days" on program_days;
create policy "own program days" on program_days
  for all to authenticated
  using (exists (select 1 from programs p where p.id = program_days.program_id and p.member_id = auth.uid()))
  with check (exists (select 1 from programs p where p.id = program_days.program_id and p.member_id = auth.uid()));

drop policy if exists "own program exercises" on program_exercises;
create policy "own program exercises" on program_exercises
  for all to authenticated
  using (
    exists (
      select 1 from program_days d
      join programs p on p.id = d.program_id
      where d.id = program_exercises.program_day_id and p.member_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from program_days d
      join programs p on p.id = d.program_id
      where d.id = program_exercises.program_day_id and p.member_id = auth.uid()
    )
  );

drop policy if exists "own sessions" on workout_sessions;
create policy "own sessions" on workout_sessions
  for all to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists "own set logs" on set_logs;
create policy "own set logs" on set_logs
  for all to authenticated
  using (
    member_id = auth.uid()
    and exists (
      select 1 from workout_sessions s
      where s.id = set_logs.session_id and s.member_id = auth.uid()
    )
  )
  with check (
    member_id = auth.uid()
    and exists (
      select 1 from workout_sessions s
      where s.id = set_logs.session_id and s.member_id = auth.uid()
    )
  );

drop policy if exists "own measurements" on body_measurements;
create policy "own measurements" on body_measurements
  for all to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists "own progress photos" on progress_photos;
create policy "own progress photos" on progress_photos
  for all to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists "own adaptations" on adaptive_adjustments;
create policy "own adaptations" on adaptive_adjustments
  for all to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists "own freezes" on streak_freezes;
create policy "own freezes" on streak_freezes
  for all to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());

-- ── Storage policies (private progress photos) ──────────────────────────────
drop policy if exists "progress photos read own" on storage.objects;
create policy "progress photos read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "progress photos insert own" on storage.objects;
create policy "progress photos insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "progress photos delete own" on storage.objects;
create policy "progress photos delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
