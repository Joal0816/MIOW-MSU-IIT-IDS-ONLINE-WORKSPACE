create type public.profile_role as enum ('student','teacher','admin');
create type public.announcement_category as enum ('urgent','event','academic');
create type public.component_type as enum ('written_work','performance_task','quarterly_exam');
create type public.submission_status as enum ('pending','submitted','graded');
create type public.scan_type as enum ('in','out');
create type public.attendance_mark as enum ('on-time','late');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  student_id text unique,
  email text unique,
  pin text,
  full_name text not null,
  role public.profile_role not null default 'student',
  rfid_uid text unique,
  avatar_url text,
  face_embedding text,
  grade_level int,
  section text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to anon, authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Public demo access" on public.profiles for all to anon, authenticated using (true) with check (true);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category public.announcement_category not null default 'academic',
  target_audience text not null default 'all',
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.announcements to anon, authenticated;
grant all on public.announcements to service_role;
alter table public.announcements enable row level security;
create policy "Public demo access" on public.announcements for all to anon, authenticated using (true) with check (true);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  code text not null unique,
  grade_level int not null,
  teacher_id uuid references public.profiles(id) on delete set null,
  color text not null default 'indigo',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.courses to anon, authenticated;
grant all on public.courses to service_role;
alter table public.courses enable row level security;
create policy "Public demo access" on public.courses for all to anon, authenticated using (true) with check (true);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  unique (student_id, course_id)
);
grant select, insert, update, delete on public.enrollments to anon, authenticated;
grant all on public.enrollments to service_role;
alter table public.enrollments enable row level security;
create policy "Public demo access" on public.enrollments for all to anon, authenticated using (true) with check (true);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  total_points int not null default 100,
  component_type public.component_type not null default 'written_work',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.assignments to anon, authenticated;
grant all on public.assignments to service_role;
alter table public.assignments enable row level security;
create policy "Public demo access" on public.assignments for all to anon, authenticated using (true) with check (true);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  file_url text,
  content text,
  score numeric,
  feedback text,
  status public.submission_status not null default 'pending',
  submitted_at timestamptz,
  unique (assignment_id, student_id)
);
grant select, insert, update, delete on public.submissions to anon, authenticated;
grant all on public.submissions to service_role;
alter table public.submissions enable row level security;
create policy "Public demo access" on public.submissions for all to anon, authenticated using (true) with check (true);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  duration_minutes int not null default 15,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quizzes to anon, authenticated;
grant all on public.quizzes to service_role;
alter table public.quizzes enable row level security;
create policy "Public demo access" on public.quizzes for all to anon, authenticated using (true) with check (true);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]',
  correct_answer text not null,
  position int not null default 0
);
grant select, insert, update, delete on public.quiz_questions to anon, authenticated;
grant all on public.quiz_questions to service_role;
alter table public.quiz_questions enable row level security;
create policy "Public demo access" on public.quiz_questions for all to anon, authenticated using (true) with check (true);

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  quarter int not null check (quarter between 1 and 4),
  written_work_score numeric,
  performance_task_score numeric,
  exam_score numeric,
  transmuted_final_grade numeric,
  unique (student_id, course_id, quarter)
);
grant select, insert, update, delete on public.grades to anon, authenticated;
grant all on public.grades to service_role;
alter table public.grades enable row level security;
create policy "Public demo access" on public.grades for all to anon, authenticated using (true) with check (true);

create table public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  "timestamp" timestamptz not null default now(),
  scan_type public.scan_type not null,
  status public.attendance_mark not null default 'on-time'
);
grant select, insert, update, delete on public.attendance_logs to anon, authenticated;
grant all on public.attendance_logs to service_role;
alter table public.attendance_logs enable row level security;
create policy "Public demo access" on public.attendance_logs for all to anon, authenticated using (true) with check (true);

insert into public.profiles (id, student_id, email, pin, full_name, role, rfid_uid, avatar_url, face_embedding, grade_level, section) values
('a0000000-0000-4000-8000-000000000001', null, 'ana.reyes@northview.edu', '0000', 'Dr. Ana Reyes', 'admin', '0099999999', 'https://ui-avatars.com/api/?name=Ana+Reyes&background=312e81&color=fff', '[0.11,-0.32,0.87,0.04]', null, null),
('b0000000-0000-4000-8000-000000000001', null, 'maria.santos@northview.edu', '1111', 'Ms. Maria Santos', 'teacher', '0099888777', 'https://ui-avatars.com/api/?name=Maria+Santos&background=4338ca&color=fff', '[0.42,0.19,-0.55,0.71]', null, null),
('b0000000-0000-4000-8000-000000000002', null, 'jose.ramirez@northview.edu', '2222', 'Mr. Jose Ramirez', 'teacher', '0099888666', 'https://ui-avatars.com/api/?name=Jose+Ramirez&background=1e40af&color=fff', '[-0.08,0.66,0.23,-0.41]', null, null),
('c0000000-0000-4000-8000-000000000001', '2024-0001', 'juan.delacruz@student.northview.edu', '1234', 'Juan Dela Cruz', 'student', '0012345678', 'https://ui-avatars.com/api/?name=Juan+Dela+Cruz&background=4f46e5&color=fff', '[0.91,-0.14,0.38,0.52]', 10, 'Emerald'),
('c0000000-0000-4000-8000-000000000002', '2024-0002', 'clara.santos@student.northview.edu', '1234', 'Maria Clara Santos', 'student', '0012345679', 'https://ui-avatars.com/api/?name=Clara+Santos&background=6366f1&color=fff', '[0.05,0.44,-0.29,0.83]', 10, 'Emerald'),
('c0000000-0000-4000-8000-000000000003', '2024-0003', 'jose.rizal@student.northview.edu', '1234', 'Jose Protacio Rizal', 'student', '0012345680', 'https://ui-avatars.com/api/?name=Jose+Rizal&background=4f46e5&color=fff', '[-0.37,0.81,0.12,0.44]', 10, 'Emerald'),
('c0000000-0000-4000-8000-000000000004', '2024-0004', 'gabriela.silang@student.northview.edu', '1234', 'Gabriela Silang', 'student', '0012345681', 'https://ui-avatars.com/api/?name=Gabriela+Silang&background=6366f1&color=fff', '[0.63,0.08,-0.71,0.22]', 10, 'Diamond'),
('c0000000-0000-4000-8000-000000000005', '2024-0005', 'andres.bonifacio@student.northview.edu', '1234', 'Andres Bonifacio', 'student', '0012345682', 'https://ui-avatars.com/api/?name=Andres+Bonifacio&background=4f46e5&color=fff', '[-0.52,0.19,0.77,-0.31]', 10, 'Diamond'),
('c0000000-0000-4000-8000-000000000006', '2024-0006', 'emilio.aguinaldo@student.northview.edu', '1234', 'Emilio Aguinaldo', 'student', '0012345683', 'https://ui-avatars.com/api/?name=Emilio+Aguinaldo&background=6366f1&color=fff', '[0.28,-0.63,0.09,0.71]', 9, 'Topaz'),
('c0000000-0000-4000-8000-000000000007', '2024-0007', 'apolinario.mabini@student.northview.edu', '1234', 'Apolinario Mabini', 'student', '0012345684', 'https://ui-avatars.com/api/?name=Apolinario+Mabini&background=4f46e5&color=fff', '[0.74,0.31,-0.18,-0.56]', 9, 'Topaz'),
('c0000000-0000-4000-8000-000000000008', '2024-0008', 'teresa.magbanua@student.northview.edu', '1234', 'Teresa Magbanua', 'student', '0012345685', 'https://ui-avatars.com/api/?name=Teresa+Magbanua&background=6366f1&color=fff', '[-0.15,0.52,0.64,0.37]', 11, 'STEM-1'),
('c0000000-0000-4000-8000-000000000009', '2024-0009', 'diego.silang@student.northview.edu', '1234', 'Diego Silang', 'student', '0012345686', 'https://ui-avatars.com/api/?name=Diego+Silang&background=4f46e5&color=fff', '[0.47,-0.72,0.26,0.13]', 11, 'STEM-1'),
('c0000000-0000-4000-8000-00000000000a', '2024-0010', 'melchora.aquino@student.northview.edu', '1234', 'Melchora Aquino', 'student', '0012345687', 'https://ui-avatars.com/api/?name=Melchora+Aquino&background=6366f1&color=fff', '[-0.61,0.24,-0.49,0.58]', 12, 'ABM-1');

insert into public.courses (id, title, code, grade_level, teacher_id, color) values
('d0000000-0000-4000-8000-000000000001', 'Mathematics 10', 'MATH10', 10, 'b0000000-0000-4000-8000-000000000001', 'indigo'),
('d0000000-0000-4000-8000-000000000002', 'Science 10', 'SCI10', 10, 'b0000000-0000-4000-8000-000000000002', 'emerald'),
('d0000000-0000-4000-8000-000000000003', 'English 10', 'ENG10', 10, 'b0000000-0000-4000-8000-000000000001', 'sky'),
('d0000000-0000-4000-8000-000000000004', 'Filipino 10', 'FIL10', 10, 'b0000000-0000-4000-8000-000000000002', 'amber'),
('d0000000-0000-4000-8000-000000000005', 'Araling Panlipunan 10', 'AP10', 10, 'b0000000-0000-4000-8000-000000000001', 'rose'),
('d0000000-0000-4000-8000-000000000006', 'TLE 10: Cookery', 'TLE10', 10, 'b0000000-0000-4000-8000-000000000002', 'violet');

insert into public.enrollments (student_id, course_id)
select s.id, c.id from public.profiles s cross join public.courses c where s.role = 'student';

insert into public.assignments (id, course_id, title, description, due_date, total_points, component_type) values
('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Problem Set 5: Quadratic Equations', 'Solve items 1-20 using factoring, completing the square, and the quadratic formula. Show complete solutions.', now() + interval '2 days', 50, 'written_work'),
('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'Quarterly Exam Reviewer', 'Comprehensive reviewer covering quadratic functions, variations, and radicals for the second quarterly exam.', now() + interval '6 days', 100, 'quarterly_exam'),
('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002', 'Lab Report: Cell Observation', 'Document your microscope observations of onion epidermal cells. Include labeled diagrams and a conclusion.', now() + interval '1 day', 40, 'performance_task'),
('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000003', 'Essay: My Filipino Hero', 'Write a 500-word persuasive essay about a Filipino hero and their relevance to today''s youth.', now() + interval '4 days', 30, 'written_work'),
('e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000004', 'Sanaysay: Wika at Kultura', 'Sumulat ng sanaysay tungkol sa papel ng wikang Filipino sa paghubog ng pambansang identidad.', now() + interval '3 days', 30, 'written_work'),
('e0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000005', 'Community Mapping Project', 'Create an annotated map of your barangay highlighting historical and cultural landmarks.', now() + interval '8 days', 60, 'performance_task'),
('e0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000006', 'Recipe Costing Worksheet', 'Compute the total cost, unit cost, and selling price of your assigned dish using the standard markup.', now() + interval '5 days', 25, 'written_work'),
('e0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000002', 'Performance Task: Ecosystem Diorama', 'Build a diorama of a Philippine ecosystem. Label the biotic and abiotic components and their interactions.', now() + interval '10 days', 80, 'performance_task');

insert into public.submissions (assignment_id, student_id, file_url, content, score, feedback, status, submitted_at) values
('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'juan_ps5_quadratics.pdf', 'Complete solutions attached. Used the quadratic formula for items 12-20.', 46, 'Excellent work! Review item 14 — sign error in the discriminant.', 'graded', now() - interval '1 day'),
('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'juan_cell_lab_report.pdf', 'Lab report with labeled onion cell diagrams.', null, null, 'submitted', now() - interval '3 hours'),
('e0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'juan_hero_essay.docx', 'Essay on Gabriela Silang.', 27, 'Strong thesis and voice. Watch comma splices in paragraph 3.', 'graded', now() - interval '2 days');

insert into public.submissions (assignment_id, student_id, content, score, status, submitted_at)
select 'e0000000-0000-4000-8000-000000000001', s.id, 'Submitted work', 38 + (abs(hashtext(s.id::text)) % 13), 'graded', now() - interval '1 day'
from public.profiles s where s.role = 'student' and s.id <> 'c0000000-0000-4000-8000-000000000001';

insert into public.quizzes (id, course_id, title, duration_minutes) values
('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Quiz 3: Quadratic Functions', 10),
('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'Quiz 2: Cell Structure', 15);

insert into public.quiz_questions (id, quiz_id, question, options, correct_answer, position) values
('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'What is the standard form of a quadratic equation?', '["y = mx + b", "ax^2 + bx + c = 0", "a^2 + b^2 = c^2", "y = a / x"]', 'ax^2 + bx + c = 0', 1),
('f1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'What is the discriminant of 2x^2 + 4x + 2 = 0?', '["0", "8", "-8", "16"]', '0', 2),
('f1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'If the discriminant is negative, the roots of the equation are:', '["real and equal", "real and distinct", "not real numbers", "both zero"]', 'not real numbers', 3),
('f1000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000001', 'What is the x-coordinate of the vertex of y = x^2 - 4x + 1?', '["2", "-2", "4", "1"]', '2', 4),
('f1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000001', 'Which method of solving quadratics makes direct use of b^2 - 4ac?', '["Factoring", "Completing the square", "Quadratic formula", "Graphing"]', 'Quadratic formula', 5),
('f2000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 'Which organelle is known as the powerhouse of the cell?', '["Nucleus", "Ribosome", "Mitochondrion", "Golgi apparatus"]', 'Mitochondrion', 1),
('f2000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 'Which structure is found in plant cells but not in animal cells?', '["Cell membrane", "Cell wall", "Cytoplasm", "Mitochondria"]', 'Cell wall', 2),
('f2000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002', 'Where does photosynthesis take place?', '["Chloroplast", "Nucleus", "Lysosome", "Ribosome"]', 'Chloroplast', 3),
('f2000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000002', 'Which organelle is primarily responsible for making proteins?', '["Smooth ER", "Ribosome", "Vacuole", "Lysosome"]', 'Ribosome', 4),
('f2000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000002', 'The control center of the cell is the:', '["Nucleus", "Cytoplasm", "Cell membrane", "Vacuole"]', 'Nucleus', 5);

insert into public.grades (student_id, course_id, quarter, written_work_score, performance_task_score, exam_score)
select s.id, c.id, 1,
  78 + (abs(hashtext(s.id::text || c.code)) % 18),
  80 + (abs(hashtext(c.code || s.id::text)) % 16),
  74 + (abs(hashtext(s.student_id || c.code)) % 21)
from public.profiles s cross join public.courses c where s.role = 'student';

insert into public.grades (student_id, course_id, quarter, written_work_score, performance_task_score, exam_score, transmuted_final_grade) values
('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 2, 84, 86, 81, 89),
('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 2, 88, 87, 85, 91),
('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 2, 87, 89, 86, 92),
('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004', 2, 85, 88, 84, 91),
('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', 2, 89, 90, 87, 93),
('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000006', 2, 92, 94, 90, 95);

update public.grades g set transmuted_final_grade = t.transmuted
from (values
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 92),
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 90),
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', 93),
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004', 89),
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', 90),
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000006', 94)
) as t(sid, cid, transmuted)
where g.student_id = t.sid::uuid and g.course_id = t.cid::uuid and g.quarter = 1;

insert into public.attendance_logs (student_id, "timestamp", scan_type, status)
select 'c0000000-0000-4000-8000-000000000001',
  ((current_date - g) + time '07:04:00') at time zone 'utc',
  'in',
  case when g = 4 then 'late'::public.attendance_mark else 'on-time'::public.attendance_mark end
from generate_series(0, 16) as g
where extract(isodow from (current_date - g)) < 6;

insert into public.attendance_logs (student_id, "timestamp", scan_type, status)
select 'c0000000-0000-4000-8000-000000000001',
  ((current_date - g) + time '16:30:00') at time zone 'utc',
  'out',
  'on-time'
from generate_series(0, 16) as g
where extract(isodow from (current_date - g)) < 6;

insert into public.announcements (id, title, content, category, target_audience, author_id, created_at) values
('aa000000-0000-4000-8000-000000000001', 'Classes Suspended Tomorrow Due to Typhoon Signal', 'Per the advisory from the city government, all classes and office work are suspended tomorrow. Stay safe and monitor official channels for updates.', 'urgent', 'all', 'a0000000-0000-4000-8000-000000000001', now() - interval '2 hours'),
('aa000000-0000-4000-8000-000000000002', 'Second Quarter Exam Schedule Released', 'The examination schedule for the second quarter is now posted on the registrar''s bulletin board. Exams run from September 7-11. Review your permits early.', 'academic', 'students', 'b0000000-0000-4000-8000-000000000001', now() - interval '1 day'),
('aa000000-0000-4000-8000-000000000003', 'Intramurals 2026: Opening Parade This Friday', 'All sections must assemble at the quadrangle by 6:30 AM in complete team uniforms. Attendance will be checked per section.', 'event', 'all', 'a0000000-0000-4000-8000-000000000001', now() - interval '2 days'),
('aa000000-0000-4000-8000-000000000004', 'Science Fair Submission Deadline Extended', 'Investigatory project manuscripts may now be submitted until next Wednesday, 5:00 PM, at the Science Department office.', 'academic', 'students', 'b0000000-0000-4000-8000-000000000002', now() - interval '3 days');