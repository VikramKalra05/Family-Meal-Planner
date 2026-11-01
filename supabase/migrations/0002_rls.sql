-- Family Meal Planner — triggers, helpers, RLS (M0)

-- ── updated_at trigger ───────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_households_updated   before update on households     for each row execute function set_updated_at();
create trigger trg_profiles_updated     before update on profiles       for each row execute function set_updated_at();
create trigger trg_recipes_updated      before update on recipes        for each row execute function set_updated_at();
create trigger trg_weekly_plans_updated before update on weekly_plans   for each row execute function set_updated_at();
create trigger trg_plan_entries_updated before update on plan_entries   for each row execute function set_updated_at();
create trigger trg_pantry_updated       before update on pantry_items   for each row execute function set_updated_at();
create trigger trg_shopping_updated     before update on shopping_lists for each row execute function set_updated_at();
create trigger trg_ai_providers_updated before update on ai_providers   for each row execute function set_updated_at();

-- ── Membership helpers (security definer avoids recursive RLS on profiles) ──
create or replace function current_profile_row() returns profiles
language sql stable security definer set search_path = public as $$
  select * from profiles where id = auth.uid();
$$;

create or replace function current_household_id() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from profiles where id = auth.uid();
$$;

create or replace function is_household_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and household_id = h);
$$;

-- ── Enable RLS everywhere ────────────────────────────────────────────────────
alter table households        enable row level security;
alter table profiles          enable row level security;
alter table ingredients       enable row level security;
alter table recipes           enable row level security;
alter table recipe_items      enable row level security;
alter table recipe_nutrition  enable row level security;
alter table weekly_plans      enable row level security;
alter table plan_entries      enable row level security;
alter table pantry_items      enable row level security;
alter table shopping_lists    enable row level security;
alter table intake_logs       enable row level security;
alter table adjustment_events enable row level security;
alter table ai_providers      enable row level security;
alter table messages          enable row level security;
alter table eval_runs         enable row level security;

-- households: create your own, read/update only households you belong to
create policy "insert own household" on households
  for insert to authenticated with check (created_by = auth.uid());
create policy "read member households" on households
  for select to authenticated using (is_household_member(id));
create policy "update own household" on households
  for update to authenticated using (created_by = auth.uid());

-- profiles: read same-household members; write yourself
create policy "read household profiles" on profiles
  for select to authenticated
  using (id = auth.uid() or (household_id is not null and is_household_member(household_id)));
create policy "insert own profile" on profiles
  for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on profiles
  for update to authenticated using (id = auth.uid());

-- ingredients: global seed readable by all authenticated; custom rows by members
create policy "read ingredients" on ingredients
  for select to authenticated using (household_id is null or is_household_member(household_id));
create policy "insert custom ingredients" on ingredients
  for insert to authenticated with check (household_id is not null and is_household_member(household_id));

-- recipes: global seed + own household; members create/edit within their household
create policy "read recipes" on recipes
  for select to authenticated using (household_id is null or is_household_member(household_id));
create policy "insert household recipes" on recipes
  for insert to authenticated
  with check (household_id is not null and is_household_member(household_id) and owner_id = auth.uid());
create policy "update own recipes" on recipes
  for update to authenticated using (owner_id = auth.uid());
create policy "delete own recipes" on recipes
  for delete to authenticated using (owner_id = auth.uid());

create policy "read recipe items" on recipe_items
  for select to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_id
                 and (r.household_id is null or is_household_member(r.household_id))));
create policy "write recipe items" on recipe_items
  for all to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from recipes r where r.id = recipe_id and r.owner_id = auth.uid()));

create policy "read recipe nutrition" on recipe_nutrition
  for select to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_id
                 and (r.household_id is null or is_household_member(r.household_id))));
create policy "write recipe nutrition" on recipe_nutrition
  for all to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from recipes r where r.id = recipe_id and r.owner_id = auth.uid()));

-- planning: any household member manages its plans
create policy "household plans" on weekly_plans
  for all to authenticated using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "household plan entries" on plan_entries
  for all to authenticated
  using (exists (select 1 from weekly_plans p where p.id = plan_id and is_household_member(p.household_id)))
  with check (exists (select 1 from weekly_plans p where p.id = plan_id and is_household_member(p.household_id)));

-- pantry & shopping: household members
create policy "household pantry" on pantry_items
  for all to authenticated using (is_household_member(household_id))
  with check (is_household_member(household_id));
create policy "household shopping" on shopping_lists
  for all to authenticated using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- intake: your own logs; household owner can read everyone's (family view)
create policy "read own or owner intake" on intake_logs
  for select to authenticated
  using (member_id = auth.uid()
         or exists (select 1 from profiles me
                    where me.id = auth.uid() and me.role = 'owner'
                    and exists (select 1 from profiles them
                                where them.id = member_id and them.household_id = me.household_id)));
create policy "write own intake" on intake_logs
  for insert to authenticated with check (member_id = auth.uid());
create policy "update own intake" on intake_logs
  for update to authenticated using (member_id = auth.uid());
create policy "delete own intake" on intake_logs
  for delete to authenticated using (member_id = auth.uid());

create policy "own adjustments" on adjustment_events
  for all to authenticated using (member_id = auth.uid())
  with check (member_id = auth.uid());

-- BYO keys: strictly per-user
create policy "own ai providers" on ai_providers
  for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- messages: household members can read household traffic; sender writes
create policy "read household messages" on messages
  for select to authenticated using (is_household_member(household_id));
create policy "send household messages" on messages
  for insert to authenticated
  with check (is_household_member(household_id)
              and (from_member = auth.uid() or from_member is null));
create policy "mark messages read" on messages
  for update to authenticated using (is_household_member(household_id));

-- eval_runs: no client policies — service role writes, nothing leaks to clients.
