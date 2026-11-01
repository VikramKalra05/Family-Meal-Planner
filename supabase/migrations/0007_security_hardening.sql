-- 0007: Security hardening from the audit
-- 1. messages: members could previously UPDATE any household message row
--    (title/body/to_member), not just mark their own as read. RLS is
--    row-level, not column-level — so mark-read moves to a scoped RPC and
--    direct updates are revoked.
drop policy "mark messages read" on messages;

create or replace function mark_message_read(msg_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update messages
  set read_at = now()
  where id = msg_id and to_member = auth.uid() and read_at is null;
end $$;

revoke all on function mark_message_read(uuid) from public, anon;
grant execute on function mark_message_read(uuid) to authenticated;

-- 2. invite codes: 8 hex chars = 32 bits — brute-forceable by a persistent
--    authenticated attacker against the join RPC. 10 chars from random bytes
--    ≈ 47+ bits, and existing codes are rotated.
alter table households alter column invite_code
  set default upper(substr(replace(replace(encode(gen_random_bytes(8), 'base64'), '+', ''), '/', ''), 1, 10));
update households
  set invite_code = upper(substr(replace(replace(encode(gen_random_bytes(8), 'base64'), '+', ''), '/', ''), 1, 10));
