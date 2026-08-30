alter table public.quizzes
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists deleted_at timestamptz;

alter table public.assignments
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists deleted_at timestamptz;

create index if not exists quizzes_active_idx on public.quizzes (course_id) where deleted_at is null;
create index if not exists assignments_active_idx on public.assignments (course_id) where deleted_at is null;

drop policy if exists "Staff read course materials" on storage.objects;
create policy "Staff read course materials"
  on storage.objects for select to authenticated
  using (bucket_id = 'course-materials');

drop policy if exists "Staff upload course materials" on storage.objects;
create policy "Staff upload course materials"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'course-materials'
    and private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role])
  );

drop policy if exists "Staff replace course materials" on storage.objects;
create policy "Staff replace course materials"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'course-materials'
    and private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role])
  )
  with check (
    bucket_id = 'course-materials'
    and private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role])
  );

drop policy if exists "Staff delete course materials" on storage.objects;
create policy "Staff delete course materials"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'course-materials'
    and private.current_profile_role() = any (array['teacher'::public.profile_role, 'admin'::public.profile_role])
  );