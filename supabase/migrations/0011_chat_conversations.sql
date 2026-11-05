-- ── Chat conversations ───────────────────────────────────────────────────────
-- "New chat" starts a conversation; the History dropdown lists them. Messages
-- point at their conversation. Legacy rows (pre-0011) are backfilled into one
-- "Previous chats" conversation per user so nothing is lost.

create table if not exists ai_chat_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null default 'New chat',
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_conversations_user_idx
  on ai_chat_conversations (user_id, created_at desc);

alter table ai_chat_conversations enable row level security;

create policy "own conversations select" on ai_chat_conversations
  for select to authenticated
  using (user_id = auth.uid());

create policy "own conversations insert" on ai_chat_conversations
  for insert to authenticated
  with check (user_id = auth.uid());

alter table ai_chat_messages add column if not exists conversation_id uuid references ai_chat_conversations(id) on delete cascade;

create index if not exists ai_chat_messages_conversation_idx
  on ai_chat_messages (conversation_id, created_at);

-- Backfill: fold each user's legacy messages into a single conversation.
insert into ai_chat_conversations (user_id, title, created_at)
select user_id, 'Previous chats', min(created_at)
from ai_chat_messages
where conversation_id is null
group by user_id;

update ai_chat_messages m
set conversation_id = c.id
from ai_chat_conversations c
where c.user_id = m.user_id and m.conversation_id is null;
