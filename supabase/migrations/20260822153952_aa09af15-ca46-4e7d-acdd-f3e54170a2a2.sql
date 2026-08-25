-- MCP OAuth access: signed-in users (authenticated role) reach their own LMS
-- data. Identity maps the OAuth token's email claim to profiles.email.

create or replace function public.auth_email()
returns text
language sql
stable
as $$ select lower(auth.jwt() ->> 'email') $$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select id from public.profiles where lower(email) = public.auth_email() limit 1 $$;

create or replace function public.current_profile_role()
returns public.profile_role
language sql
stable
security definer
set search_path = public
as $$ select role from public.profiles where lower(email) = public.auth_email() limit 1 $$;

grant select on public.profiles to authenticated;
grant select on public.announcements to authenticated;
grant select on public.courses to authenticated;
grant select on public.enrollments to authenticated;
grant select on public.assignments to authenticated;
grant select, insert, update on public.submissions to authenticated;
grant select on public.quizzes to authenticated;
grant select on public.quiz_questions to authenticated;
grant select on public.grades to authenticated;
grant select on public.attendance_logs to authenticated;

create policy "Users read own profile" on public.profiles for select to authenticated
  using (lower(email) = public.auth_email());
create policy "Staff read all profiles" on public.profiles for select to authenticated
  using (public.current_profile_role() in ('teacher','admin'));

create policy "Signed-in users read announcements" on public.announcements for select to authenticated
  using (true);

create policy "Signed-in users read courses" on public.courses for select to authenticated
  using (true);

create policy "Signed-in users read assignments" on public.assignments for select to authenticated
  using (true);

create policy "Signed-in users read quizzes" on public.quizzes for select to authenticated
  using (true);

create policy "Staff read quiz questions" on public.quiz_questions for select to authenticated
  using (public.current_profile_role() in ('teacher','admin'));

create policy "Students read own enrollments" on public.enrollments for select to authenticated
  using (student_id = public.current_profile_id());
create policy "Staff read all enrollments" on public.enrollments for select to authenticated
  using (public.current_profile_role() in ('teacher','admin'));

create policy "Students read own grades" on public.grades for select to authenticated
  using (student_id = public.current_profile_id());
create policy "Staff read all grades" on public.grades for select to authenticated
  using (public.current_profile_role() in ('teacher','admin'));

create policy "Students read own attendance" on public.attendance_logs for select to authenticated
  using (student_id = public.current_profile_id());
create policy "Staff read all attendance" on public.attendance_logs for select to authenticated
  using (public.current_profile_role() in ('teacher','admin'));

create policy "Students read own submissions" on public.submissions for select to authenticated
  using (student_id = public.current_profile_id());
create policy "Staff read all submissions" on public.submissions for select to authenticated
  using (public.current_profile_role() in ('teacher','admin'));
create policy "Students create own submissions" on public.submissions for insert to authenticated
  with check (student_id = public.current_profile_id());
create policy "Students update own submissions" on public.submissions for update to authenticated
  using (student_id = public.current_profile_id())
  with check (student_id = public.current_profile_id());