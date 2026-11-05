-- ── AI assistant chat history ────────────────────────────────────────────────
-- One row per chat message (user, assistant, or system note). The assistant
-- panel loads the recent thread on open; tool traces and confirmation-card
-- payloads ride in `meta` jsonb. History is immutable after insert — no
-- update/delete policies, so a bug or a crafted request can never rewrite
-- what the assistant claimed or did.

create table if not exists ai_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant', 'system')),
  content    text not null,
  meta       jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_user_created_idx
  on ai_chat_messages (user_id, created_at desc);

alter table ai_chat_messages enable row level security;

create policy "own chat messages select" on ai_chat_messages
  for select to authenticated
  using (user_id = auth.uid());

create policy "own chat messages insert" on ai_chat_messages
  for insert to authenticated
  with check (user_id = auth.uid());
