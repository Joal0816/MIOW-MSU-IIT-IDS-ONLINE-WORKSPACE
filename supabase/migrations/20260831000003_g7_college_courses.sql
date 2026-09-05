-- G7-College 10-level course model (G7..G12 + College 1st-4th = grade_level 7..16)
-- Keep numeric grade_level for backwards compat: 7=G7, 8=G8, 9=G9, 10=G10, 11=G11, 12=G12, 13=College 1st Yr, 14=2nd, 15=3rd, 16=4th
-- Add education_level enum-like check, college_year 1-4, strand (SHS G11-12), program (College)

alter table public.courses add column if not exists education_level text check (education_level in ('jhs','shs','college')) default 'jhs';
alter table public.courses add column if not exists college_year int check (college_year between 1 and 4);
alter table public.courses add column if not exists strand text;
alter table public.courses add column if not exists program text;

-- Backfill existing rows: 7-10 => jhs, 11-12 => shs, 13-16 => college
update public.courses
set education_level = case
  when grade_level >= 13 then 'college'
  when grade_level >= 11 then 'shs'
  else 'jhs'
end
where education_level is null or education_level = 'jhs';

-- Backfill college_year for 13-16
update public.courses set college_year = grade_level - 12 where grade_level between 13 and 16 and college_year is null;

-- Keep check clean: clear college_year for non-college, strand only for shs, program only for college
-- (no hard enforcement via trigger yet; app validates)

-- Comment for pedagogical alias
comment on table public.assignments is 'pedagogical label: Activity (Assignments table kept for DB compat)';
comment on column public.courses.grade_level is 'Unified level: 7=G7 .. 12=G12, 13=College 1st Yr .. 16=College 4th Yr';
comment on column public.courses.education_level is 'jhs (G7-10) | shs (G11-12) | college (Yr1-4)';
