create schema if not exists private;

create or replace function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select id from public.profiles where lower(email) = public.auth_email() limit 1 $$;

create or replace function private.current_profile_role()
returns public.profile_role
language sql
stable
security definer
set search_path = public
as $$ select role from public.profiles where lower(email) = public.auth_email() limit 1 $$;

grant usage on schema private to authenticated;
grant execute on function private.current_profile_id() to authenticated;
grant execute on function private.current_profile_role() to authenticated;

-- Recreate all policies that referenced the public helpers
drop policy "Staff read all profiles" on public.profiles;
create policy "Staff read all profiles" on public.profiles for select to authenticated
  using (private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role]));

drop policy "Staff read quiz questions" on public.quiz_questions;
create policy "Staff read quiz questions" on public.quiz_questions for select to authenticated
  using (private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role]));

drop policy "Students read own enrollments" on public.enrollments;
create policy "Students read own enrollments" on public.enrollments for select to authenticated
  using (student_id = private.current_profile_id());

drop policy "Staff read all enrollments" on public.enrollments;
create policy "Staff read all enrollments" on public.enrollments for select to authenticated
  using (private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role]));

drop policy "Students read own grades" on public.grades;
create policy "Students read own grades" on public.grades for select to authenticated
  using (student_id = private.current_profile_id());

drop policy "Staff read all grades" on public.grades;
create policy "Staff read all grades" on public.grades for select to authenticated
  using (private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role]));

drop policy "Students read own attendance" on public.attendance_logs;
create policy "Students read own attendance" on public.attendance_logs for select to authenticated
  using (student_id = private.current_profile_id());

drop policy "Staff read all attendance" on public.attendance_logs;
create policy "Staff read all attendance" on public.attendance_logs for select to authenticated
  using (private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role]));

drop policy "Students read own submissions" on public.submissions;
create policy "Students read own submissions" on public.submissions for select to authenticated
  using (student_id = private.current_profile_id());

drop policy "Staff read all submissions" on public.submissions;
create policy "Staff read all submissions" on public.submissions for select to authenticated
  using (private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role]));

drop policy "Students create own submissions" on public.submissions;
create policy "Students create own submissions" on public.submissions for insert to authenticated
  with check (student_id = private.current_profile_id());

drop policy "Students update own submissions" on public.submissions;
create policy "Students update own submissions" on public.submissions for update to authenticated
  using (student_id = private.current_profile_id())
  with check (student_id = private.current_profile_id());

-- Remove the API-exposed versions
drop function public.current_profile_id();
drop function public.current_profile_role();

-- Staff-only write policies for catalog tables
create policy "Staff manage courses" on public.courses for all to authenticated
  using (private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role]))
  with check (private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role]));

create policy "Staff manage assignments" on public.assignments for all to authenticated
  using (private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role]))
  with check (private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role]));

create policy "Staff manage quizzes" on public.quizzes for all to authenticated
  using (private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role]))
  with check (private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role]));

create policy "Staff manage announcements" on public.announcements for all to authenticated
  using (private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role]))
  with check (private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role]));