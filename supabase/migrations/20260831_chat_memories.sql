-- Chat memories for long-term AI chatbot context (Task 22)
-- Stores per-profile conversation summaries so ClassMate remembers past sessions.

create table if not exists public.chat_memories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  summary text not null,
  last_n_messages jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.chat_memories enable row level security;

-- Server-only access; service_role bypasses RLS and is used by lms.server.ts
grant all on public.chat_memories to service_role;

create index if not exists chat_memories_profile_idx
  on public.chat_memories (profile_id);

create index if not exists chat_memories_profile_updated_idx
  on public.chat_memories (profile_id, updated_at desc);

-- Ensure no public policy exposes memories
drop policy if exists "Public demo access" on public.chat_memories;
