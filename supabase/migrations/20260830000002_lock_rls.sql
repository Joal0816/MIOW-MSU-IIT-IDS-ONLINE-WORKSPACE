-- RLS lockdown: drop open "Public demo access" policies (Phase 1)
-- Every LMS table is default-deny; only the service_role admin client
-- (src/integrations/supabase/client.server.ts) accesses data.
-- After this migration, anon/authenticated have no usable policy and
-- therefore get zero rows, even though grants are retained. service_role
-- bypasses RLS, so server functions keep working.

-- profiles
drop policy if exists "Public demo access" on public.profiles;
-- keep grants but without a policy anon/authenticated read is denied;
-- service_role bypasses RLS so the server layer is unaffected.
-- Example scoped policy for direct authenticated access (if ever needed):
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

-- announcements
drop policy if exists "Public demo access" on public.announcements;

-- courses
drop policy if exists "Public demo access" on public.courses;

-- enrollments
drop policy if exists "Public demo access" on public.enrollments;

-- assignments
drop policy if exists "Public demo access" on public.assignments;

-- submissions
drop policy if exists "Public demo access" on public.submissions;

-- quizzes
drop policy if exists "Public demo access" on public.quizzes;

-- quiz_questions
drop policy if exists "Public demo access" on public.quiz_questions;

-- grades
drop policy if exists "Public demo access" on public.grades;

-- attendance_logs
drop policy if exists "Public demo access" on public.attendance_logs;

-- sessions (created in 20260830000001)
drop policy if exists "Public demo access" on public.sessions;

-- Ensure RLS stays enabled (idempotent)
alter table public.profiles enable row level security;
alter table public.announcements enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.grades enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.sessions enable row level security;

-- service_role retains full access (bypasses RLS, but grant is explicit)
grant all on public.profiles to service_role;
grant all on public.announcements to service_role;
grant all on public.courses to service_role;
grant all on public.enrollments to service_role;
grant all on public.assignments to service_role;
grant all on public.submissions to service_role;
grant all on public.quizzes to service_role;
grant all on public.quiz_questions to service_role;
grant all on public.grades to service_role;
grant all on public.attendance_logs to service_role;
grant all on public.sessions to service_role;
