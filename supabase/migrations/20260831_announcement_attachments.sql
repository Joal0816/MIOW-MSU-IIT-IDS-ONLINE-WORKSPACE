-- Announcement attachments (Task 21): dropzone file support for announcements
-- Reuses the private storage pattern of course-materials; table is server-only
-- (service_role) and gated through lms.server handlers.

create table if not exists public.announcement_attachments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  file_url text not null,
  file_name text,
  file_size int,
  mime text,
  created_at timestamptz not null default now()
);

alter table public.announcement_attachments enable row level security;

-- Server-only access; anon/authenticated get no rows (defense in depth)
grant all on public.announcement_attachments to service_role;

-- Fast lookup for one announcement's files
create index if not exists announcement_attachments_announcement_idx
  on public.announcement_attachments (announcement_id);

-- Ensure no public policy exists
drop policy if exists "Public demo access" on public.announcement_attachments;
