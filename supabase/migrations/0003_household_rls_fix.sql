-- Fixes the household chicken-and-egg RLS bugs:
--
-- 1. CREATE: "insert own household" passes, but INSERT ... RETURNING needs the
--    new row to satisfy a SELECT policy. The old SELECT policy required
--    membership, which cannot exist before the row does. The creator now sees
--    households they created.
--
-- 2. JOIN: looking up a household by invite code requires SELECT on a row the
--    joiner has no membership in. Exposed instead as a security-definer RPC
--    that leaks only the id for a valid code — never the households table.

drop policy "read member households" on households;
create policy "read member households" on households
  for select to authenticated
  using (created_by = auth.uid() or is_household_member(id));

create or replace function household_id_for_invite_code(code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from households where invite_code = upper(trim(code))
$$;

revoke execute on function household_id_for_invite_code(text) from anon, public;
grant execute on function household_id_for_invite_code(text) to authenticated;
