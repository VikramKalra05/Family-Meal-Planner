-- Recipe media: tagged photos and watch-later video links per recipe.
-- kind video = link out (YouTube/Instagram reel); kind image = picture URL
-- (also used as card art when the recipe has no image_url).

create type recipe_media_kind as enum ('image', 'video');

create table recipe_media (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references recipes(id) on delete cascade,
  kind       recipe_media_kind not null default 'video',
  url        text not null,
  label      text,
  created_at timestamptz not null default now()
);

create index recipe_media_recipe_idx on recipe_media (recipe_id, kind);

alter table recipe_media enable row level security;

-- Read alongside the recipe: global (seed) recipes are visible to all
-- authenticated users; household recipes to their members.
create policy "read recipe media" on recipe_media
  for select to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_id
                 and (r.household_id is null or is_household_member(r.household_id))));

-- Family members tag videos/photos on any recipe they can see; it is a
-- shared library, and links carry no private data.
create policy "tag recipe media" on recipe_media
  for insert to authenticated
  with check (exists (select 1 from recipes r where r.id = recipe_id
                 and (r.household_id is null or is_household_member(r.household_id))));

create policy "untag recipe media" on recipe_media
  for delete to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_id
                 and (r.household_id is null or is_household_member(r.household_id))));
