-- Tighten the messages INSERT policy.
--
-- The original policy (0002_rls.sql) allowed `from_member IS NULL`, so any
-- household member could insert sender-less rows that render like system
-- traffic. Every app path sets from_member to the authenticated profile, so
-- the null branch is no longer needed.

drop policy if exists "send household messages" on messages;

create policy "send household messages" on messages
  for insert to authenticated
  with check (is_household_member(household_id) and from_member = auth.uid());
