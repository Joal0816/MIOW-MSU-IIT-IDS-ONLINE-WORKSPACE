-- Task 24: worksheet uploads — submission_files linked to submissions
-- Service-role only (RLS locked down; server functions manage storage).

create table if not exists public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  mime text,
  created_at timestamptz not null default now()
);

create index if not exists submission_files_submission_idx
  on public.submission_files (submission_id);

alter table public.submission_files enable row level security;

drop policy if exists "Public demo access" on public.submission_files;
-- No authenticated policies — service_role only (bypasses RLS)
grant all on public.submission_files to service_role;
