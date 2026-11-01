-- Family Meal Planner — core schema (M0)
-- Applied via `supabase db push` or the Supabase SQL editor.

-- ── Enums ────────────────────────────────────────────────────────────────────
create type household_role    as enum ('owner', 'member', 'staff');
create type sex_type          as enum ('male', 'female');
create type activity_level    as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');
create type goal_type         as enum ('weight_loss', 'maintenance', 'muscle_gain');
create type diet_type         as enum ('veg', 'egg', 'non_veg');
create type recipe_source     as enum ('seed', 'user', 'reel');
create type nutrition_method  as enum ('computed', 'ai_estimated');
create type meal_slot         as enum ('breakfast', 'lunch', 'snack', 'dinner');
create type plan_entry_status as enum ('planned', 'cooked', 'eaten', 'skipped');
create type message_kind      as enum ('suggestion', 'instruction', 'system');

-- ── Households ───────────────────────────────────────────────────────────────
create table households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  currency    text not null default 'INR',
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Profiles (1:1 with auth.users) ───────────────────────────────────────────
create table profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  household_id   uuid references households(id) on delete set null,
  role           household_role not null default 'member',
  display_name   text not null,
  sex            sex_type,
  date_of_birth  date,
  height_cm      numeric(5, 1),
  weight_kg      numeric(5, 1),
  activity_level activity_level,
  goal           goal_type,
  diet_type      diet_type not null default 'veg',
  allergies      text[] not null default '{}',
  budget_daily   numeric(10, 2),
  -- cached engine output; recomputed whenever body metrics/goal change
  targets_cache  jsonb,
  targets_version integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── Master ingredient DB (per-100g nutrition; global rows are seed data) ─────
create table ingredients (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid references households(id) on delete cascade, -- null = global
  name            text not null,
  name_hi         text,
  category        text,
  kcal_per_100g   numeric not null,
  protein_per_100g numeric not null,
  carbs_per_100g  numeric not null,
  fat_per_100g    numeric not null,
  fiber_per_100g  numeric,
  cost_per_100g   numeric,
  created_at      timestamptz not null default now()
);
create unique index ingredients_name_unique
  on ingredients (coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- ── Recipes ──────────────────────────────────────────────────────────────────
create table recipes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade, -- null = global seed
  owner_id     uuid references auth.users(id) on delete set null,
  title        text not null,
  description  text,
  source_type  recipe_source not null default 'user',
  source_url   text,
  servings     integer not null default 1 check (servings > 0),
  prep_minutes integer,
  steps        jsonb not null default '[]',
  image_url    text,
  is_veg       boolean not null default true,
  cuisine      text,
  region       text,
  verified     boolean not null default false,
  confidence   numeric(3, 2) check (confidence between 0 and 1),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table recipe_items (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete set null,
  freeform_name text,
  quantity_g    numeric,
  quantity_units numeric,
  unit          text default 'g',
  grams_estimate numeric,
  note          text
);

create table recipe_nutrition (
  recipe_id   uuid primary key references recipes(id) on delete cascade,
  kcal        numeric not null,
  protein_g   numeric not null,
  carbs_g     numeric not null,
  fat_g       numeric not null,
  fiber_g     numeric,
  method      nutrition_method not null,
  computed_at timestamptz not null default now()
);

-- ── Weekly planning ──────────────────────────────────────────────────────────
create table weekly_plans (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  week_start   date not null,
  status       text not null default 'draft',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, week_start)
);

-- member_id null = shared family dish (e.g. dinner); member_portions holds
-- per-member serving multipliers for shared dishes.
create table plan_entries (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references weekly_plans(id) on delete cascade,
  entry_date     date not null,
  slot           meal_slot not null,
  recipe_id      uuid not null references recipes(id),
  member_id      uuid references profiles(id) on delete cascade,
  servings_base  numeric not null default 1,
  member_portions jsonb,
  status         plan_entry_status not null default 'planned',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index plan_entries_date_idx on plan_entries (entry_date, slot);

-- ── Household pantry & shopping ──────────────────────────────────────────────
create table pantry_items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete set null,
  name          text not null,
  quantity      numeric not null default 0,
  unit          text not null default 'g',
  updated_at    timestamptz not null default now()
);

create table shopping_lists (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  week_start   date not null,
  items        jsonb not null default '[]', -- [{name, quantity, unit, checked, est_cost}]
  status       text not null default 'open',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Intake tracking & adaptation ─────────────────────────────────────────────
create table intake_logs (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references profiles(id) on delete cascade,
  logged_on   date not null,
  slot        meal_slot,
  recipe_id   uuid references recipes(id) on delete set null,
  description text,
  kcal        numeric not null,
  protein_g   numeric not null,
  carbs_g     numeric not null,
  fat_g       numeric not null,
  fiber_g     numeric,
  source      text not null default 'form', -- form | plan | ai_chat
  created_at  timestamptz not null default now()
);
create index intake_logs_member_date_idx on intake_logs (member_id, logged_on);

create table adjustment_events (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references profiles(id) on delete cascade,
  event_date     date not null,
  trigger        text not null, -- craving | skipped_meal | manual
  consumed       jsonb not null,
  reoptimization jsonb,
  created_at     timestamptz not null default now()
);

-- ── BYO LLM providers (keys encrypted app-side before insert) ────────────────
create table ai_providers (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  label            text not null,
  base_url         text not null,
  api_key_encrypted text not null,
  model            text not null,
  is_default       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, label)
);

-- ── Family suggestions & cook instructions ───────────────────────────────────
create table messages (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  from_member  uuid references profiles(id) on delete set null,
  to_member    uuid references profiles(id) on delete cascade,
  kind         message_kind not null default 'suggestion',
  title        text not null,
  body         text not null,
  payload      jsonb,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- ── Evaluation experiments (service-role writes only) ────────────────────────
create table eval_runs (
  id         uuid primary key default gen_random_uuid(),
  experiment text not null,
  params     jsonb not null default '{}',
  results    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
