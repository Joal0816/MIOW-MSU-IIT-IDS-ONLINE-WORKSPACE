-- Score gating: teacher-controlled release of scores and answer keys (Task 23)
-- Students see \"Awaiting teacher release\" until the teacher toggles release.

alter table public.quizzes
  add column if not exists score_released boolean not null default false;

alter table public.quizzes
  add column if not exists answer_key_released boolean not null default false;

alter table public.assignments
  add column if not exists score_released boolean not null default false;

-- quiz_attempts exists from 20260825084204; add per-attempt release flag if present
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'quiz_attempts'
  ) then
    alter table public.quiz_attempts add column if not exists released boolean not null default false;
  end if;
end $$;

-- Backfill comment for clarity
comment on column public.quizzes.score_released is 'When false, students see Awaiting teacher release instead of their score';
comment on column public.quizzes.answer_key_released is 'When false, answer key / per-question review stays hidden';
comment on column public.assignments.score_released is 'When false, assignment scores stay hidden from students';
