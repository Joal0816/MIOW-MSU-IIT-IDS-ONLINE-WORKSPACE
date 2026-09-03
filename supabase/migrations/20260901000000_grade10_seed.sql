-- =============================================================================
-- SEED DATA — Replace demo seed with real Grade 10 roster + IT10 course
-- =============================================================================
-- Run AFTER the initial migration (20260822144314).
-- This deletes the old demo profiles/courses/quizzes/etc. and inserts the real
-- Grade 10 roster: 1 admin, 1 teacher, 122 students across 4 sections (Omega,
-- Phi, Sigma, Tau) and one IT10 course.
-- =============================================================================

-- ── 1. Remove old seed data (in dependency order) ──────────────────────────
DELETE FROM public.attendance_logs
  WHERE student_id IN (SELECT id FROM public.profiles WHERE role = 'student' AND student_id LIKE '2024-%');

DELETE FROM public.grades
  WHERE student_id IN (SELECT id FROM public.profiles WHERE role = 'student' AND student_id LIKE '2024-%');

DELETE FROM public.submissions
  WHERE student_id IN (SELECT id FROM public.profiles WHERE role = 'student' AND student_id LIKE '2024-%');

DELETE FROM public.quiz_questions
  WHERE quiz_id IN (SELECT id FROM public.quizzes WHERE course_id IN (SELECT id FROM public.courses WHERE code IN ('MATH10','SCI10','ENG10','FIL10','AP10','TLE10')));

DELETE FROM public.quizzes
  WHERE course_id IN (SELECT id FROM public.courses WHERE code IN ('MATH10','SCI10','ENG10','FIL10','AP10','TLE10'));

DELETE FROM public.assignments
  WHERE course_id IN (SELECT id FROM public.courses WHERE code IN ('MATH10','SCI10','ENG10','FIL10','AP10','TLE10'));

DELETE FROM public.enrollments
  WHERE student_id IN (SELECT id FROM public.profiles WHERE role = 'student' AND student_id LIKE '2024-%')
     OR course_id IN (SELECT id FROM public.courses WHERE code IN ('MATH10','SCI10','ENG10','FIL10','AP10','TLE10'));

DELETE FROM public.courses WHERE code IN ('MATH10','SCI10','ENG10','FIL10','AP10','TLE10');

DELETE FROM public.profiles
  WHERE email LIKE '%@northview.edu'
     OR id IN ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');

-- Also remove old student profiles by UUID prefix
DELETE FROM public.profiles WHERE id::text LIKE 'c0000000-0000-4000-8000-00000000000%';

-- Update old admin profile in place (same UUID, new email/name)
UPDATE public.profiles
SET email = 'admin@msuiit.edu.ph',
    full_name = 'Admin',
    avatar_url = 'https://ui-avatars.com/api/?name=Admin&background=312e81&color=fff'
WHERE id = 'a0000000-0000-4000-8000-000000000001';

-- Remove old announcements authored by deleted profiles
DELETE FROM public.announcements;

-- ── 2. Insert new seed data ───────────────────────────────────────────────

-- ── Teacher — Dr. Alan L. Vergara (sole teacher) ────────────────────────────
INSERT INTO public.profiles (id, student_id, email, pin, full_name, role, rfid_uid, avatar_url, grade_level, section) VALUES
('b0000000-0000-4000-8000-000000000003', NULL, 'alan.vergara@g.msuiit.edu.ph', '3333', 'Dr. Alan L. Vergara', 'teacher', '0099888555', 'https://ui-avatars.com/api/?name=Alan+Vergara&background=059669&color=fff', NULL, NULL);

-- ── IT10 Course ─────────────────────────────────────────────────────────────
INSERT INTO public.courses (id, title, code, grade_level, teacher_id, color) VALUES
('d0000000-0000-4000-8000-000000000007', 'Information Technology 10', 'IT10', 10, 'b0000000-0000-4000-8000-000000000003', 'teal');

-- ── Joseph Alan B. Vergara (student) ────────────────────────────────────────
INSERT INTO public.profiles (id, student_id, email, pin, full_name, role, rfid_uid, avatar_url, grade_level, section) VALUES
('c0000000-0000-4000-8000-00000000000b', '2026-0000', 'josephalan.vergara@g.msuiit.edu.ph', '1234', 'Joseph Alan B. Vergara', 'student', NULL, 'https://ui-avatars.com/api/?name=Joseph+Vergara&background=4f46e5&color=fff', 10, 'Omega');

-- ─────────────────────────────────────────────────────────────────────────────
-- GRADE 10 STUDENTS — 121 students across 4 sections
-- NOTE: All students use PIN '1234' — these are test/placeholder credentials.
--       Change or randomize before deploying to production.
-- ─────────────────────────────────────────────────────────────────────────────

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ GRADE 10 - OMEGA (Adviser: Ella Joan D. Mendoza-Cuizon) — 30 students │
-- └─────────────────────────────────────────────────────────────────────────┘
INSERT INTO public.profiles (student_id, email, pin, full_name, role, rfid_uid, grade_level, section, avatar_url) VALUES
('2026-0001', 'sittieainah.abdullah@g.msuiit.edu.ph', '1234', 'Sittie Ainah Abdullah', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Sittie+Ainah+Abdullah&background=4f46e5&color=fff'),
('2026-0002', 'duncanirving.achondo@g.msuiit.edu.ph', '1234', 'Duncan Irving Achondo', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Duncan+Irving+Achondo&background=6366f1&color=fff'),
('2026-0003', 'samanthajane.aruelo@g.msuiit.edu.ph', '1234', 'Samantha Jane Aruelo', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Samantha+Jane+Aruelo&background=8b5cf6&color=fff'),
('2026-0004', 'aizekiel.basalo@g.msuiit.edu.ph', '1234', 'Aizekiel Basalo', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Aizekiel+Basalo&background=4f46e5&color=fff'),
('2026-0005', 'shanceyalfhea.bianson@g.msuiit.edu.ph', '1234', 'Shancey Alfhea Bianson', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Shancey+Alfhea+Bianson&background=6366f1&color=fff'),
('2026-0006', 'donnelanthony.blanco@g.msuiit.edu.ph', '1234', 'Donnel Anthony Blanco', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Donnel+Anthony+Blanco&background=4f46e5&color=fff'),
('2026-0007', 'louisemichaella.bugo@g.msuiit.edu.ph', '1234', 'Louise Michaella Bugo', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Louise+Michaella+Bugo&background=6366f1&color=fff'),
('2026-0008', 'clecel.delosantos@g.msuiit.edu.ph', '1234', 'Clecel Delos Santos', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Clecel+Delos+Santos&background=8b5cf6&color=fff'),
('2026-0009', 'azriel.exile@g.msuiit.edu.ph', '1234', 'Azriel dC. Exile', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Azriel+Exile&background=4f46e5&color=fff'),
('2026-0010', 'allison.gabutan@g.msuiit.edu.ph', '1234', 'Allison Gabutan', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Allison+Gabutan&background=6366f1&color=fff'),
('2026-0011', 'julianaemmanuelle.hiadan@g.msuiit.edu.ph', '1234', 'Juliana Emmanuelle Hiadan', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Juliana+Emmanuelle+Hiadan&background=8b5cf6&color=fff'),
('2026-0012', 'jaredvince.ibay@g.msuiit.edu.ph', '1234', 'Jared Vince Ibay', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Jared+Vince+Ibay&background=4f46e5&color=fff'),
('2026-0013', 'badrie.ibrahim@g.msuiit.edu.ph', '1234', 'Badrie Ibrahim', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Badrie+Ibrahim&background=6366f1&color=fff'),
('2026-0014', 'kyliemaxine.lacastesantos@g.msuiit.edu.ph', '1234', 'Kylie Maxine Lacastesantos', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Kylie+Maxine+Lacastesantos&background=8b5cf6&color=fff'),
('2026-0015', 'xhun.lao@g.msuiit.edu.ph', '1234', 'Xhun Lao', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Xhun+Lao&background=4f46e5&color=fff'),
('2026-0016', 'xypaulmatthew.loquinte@g.msuiit.edu.ph', '1234', 'Xy- Paul Matthew Loquinte', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Xy+Paul+Matthew+Loquinte&background=6366f1&color=fff'),
('2026-0017', 'annekassidy.luceno@g.msuiit.edu.ph', '1234', 'Anne Cassidy Luceño', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Anne+Cassidy+Luceno&background=8b5cf6&color=fff'),
('2026-0018', 'ameraaisah.lucman@g.msuiit.edu.ph', '1234', 'Amera Aisah Lucman', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Amera+Aisah+Lucman&background=6366f1&color=fff'),
('2026-0019', 'zainanadheera.macarambon@g.msuiit.edu.ph', '1234', 'Zaina Nadheera Macarambon', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Zaina+Nadheera+Macarambon&background=8b5cf6&color=fff'),
('2026-0020', 'princesswidad.macaraya@g.msuiit.edu.ph', '1234', 'Princess Widad Macaraya', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Princess+Widad+Macaraya&background=6366f1&color=fff'),
('2026-0021', 'lemarcusseth.madjus@g.msuiit.edu.ph', '1234', 'Lemarcus Seth Madjus', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Lemarcus+Seth+Madjus&background=8b5cf6&color=fff'),
('2026-0022', 'mohammadishaq.magarang@g.msuiit.edu.ph', '1234', 'Mohammad Ishaq Magarang', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Mohammad+Ishaq+Magarang&background=4f46e5&color=fff'),
('2026-0023', 'anikainjeela.magomnang@g.msuiit.edu.ph', '1234', 'Anika Injeela Magomnang', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Anika+Injeela+Magomnang&background=6366f1&color=fff'),
('2026-0024', 'johanaxl.neri@g.msuiit.edu.ph', '1234', 'Johan Axl Neri', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Johan+Axl+Neri&background=4f46e5&color=fff'),
('2026-0025', 'jaydenmatthew.paloma@g.msuiit.edu.ph', '1234', 'Jayden Matthew Paloma', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Jayden+Matthew+Paloma&background=6366f1&color=fff'),
('2026-0026', 'lauricegabrielle.pastor@g.msuiit.edu.ph', '1234', 'Laurice Gabrielle Pastor', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Laurice+Gabrielle+Pastor&background=8b5cf6&color=fff'),
('2026-0027', 'juliannafaye.sanchez@g.msuiit.edu.ph', '1234', 'Julianna Faye Sanchez', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Julianna+Faye+Sanchez&background=6366f1&color=fff'),
('2026-0028', 'jhalanie.sarip@g.msuiit.edu.ph', '1234', 'Jhalanie Sarip', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Jhalanie+Sarip&background=4f46e5&color=fff'),
('2026-0029', 'alainmark.tomarong@g.msuiit.edu.ph', '1234', 'Alain Mark Tomarong', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Alain+Mark+Tomarong&background=6366f1&color=fff'),
('2026-0030', 'ravenjoy.ungria@g.msuiit.edu.ph', '1234', 'Raven Joy Ungria', 'student', NULL, 10, 'Omega', 'https://ui-avatars.com/api/?name=Raven+Joy+Ungria&background=8b5cf6&color=fff');

-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ GRADE 10 - PHI (Adviser: Rovic E. Perocho) — 30 students              │
-- └─────────────────────────────────────────────────────────────────────────┘
INSERT INTO public.profiles (student_id, email, pin, full_name, role, rfid_uid, grade_level, section, avatar_url) VALUES
('2026-0031', 'abdulmughni.abdisa@g.msuiit.edu.ph', '1234', 'Abdul Mughni Abdisa', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Abdul+Mughni+Abdisa&background=059669&color=fff'),
('2026-0032', 'attheyaalyssandra.anwar@g.msuiit.edu.ph', '1234', 'Atheya Alyssandra Anwar', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Atheya+Alyssandra+Anwar&background=10b981&color=fff'),
('2026-0033', 'aleksandraricayos@g.msuiit.edu.ph', '1234', 'Aleksandr O. Aricayos', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Aleksandr+Aricayos&background=059669&color=fff'),
('2026-0034', 'zedrickjohn.baje@g.msuiit.edu.ph', '1234', 'Zedrick John Baje', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Zedrick+John+Baje&background=10b981&color=fff'),
('2026-0035', 'juliana.bicos@g.msuiit.edu.ph', '1234', 'Juliana Bicos', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Juliana+Bicos&background=059669&color=fff'),
('2026-0036', 'keziah.bocuya@g.msuiit.edu.ph', '1234', 'Keziah Bocuya', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Keziah+Bocuya&background=10b981&color=fff'),
('2026-0037', 'fonzdexter.canalita@g.msuiit.edu.ph', '1234', 'Fonz Dexter Canalita', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Fonz+Dexter+Canalita&background=059669&color=fff'),
('2026-0038', 'aubrienneashlee.castillon@g.msuiit.edu.ph', '1234', 'Aubrienne Ashlee Castillon', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Aubrienne+Ashlee+Castillon&background=10b981&color=fff'),
('2026-0039', 'julianna.dampil@g.msuiit.edu.ph', '1234', 'Juliana Dampil', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Juliana+Dampil&background=059669&color=fff'),
('2026-0040', 'ericaryanne.delosantos@g.msuiit.edu.ph', '1234', 'Erica Ryanne Delos Santos', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Erica+Ryanne+Delos+Santos&background=10b981&color=fff'),
('2026-0041', 'kiannicholas.fin@g.msuiit.edu.ph', '1234', 'Kian Nicholas Fin', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Kian+Nicholas+Fin&background=059669&color=fff'),
('2026-0042', 'erichmarie.flores@g.msuiit.edu.ph', '1234', 'Erich Marie Flores', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Erich+Marie+Flores&background=10b981&color=fff'),
('2026-0043', 'janadorothy.gasparin@g.msuiit.edu.ph', '1234', 'Jana Dorothy Gasparin', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Jana+Dorothy+Gasparin&background=059669&color=fff'),
('2026-0044', 'isobelle.guanzon@g.msuiit.edu.ph', '1234', 'Isobelle Guanzon', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Isobelle+Guanzon&background=10b981&color=fff'),
('2026-0045', 'sittieaisah.hadjiamen@g.msuiit.edu.ph', '1234', 'Sittie Aisah Hadji Amen', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Sittie+Aisah+Hadji+Amen&background=059669&color=fff'),
('2026-0046', 'joshanton.longgakit@g.msuiit.edu.ph', '1234', 'Josh Anton Longgakit', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Josh+Anton+Longgakit&background=10b981&color=fff'),
('2026-0047', 'arianamari.loquillano@g.msuiit.edu.ph', '1234', 'Ariana Mari Loquillano', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Ariana+Mari+Loquillano&background=059669&color=fff'),
('2026-0048', 'anniyazahra.macarambon@g.msuiit.edu.ph', '1234', 'Anniya Zahra Macarambon', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Anniya+Zahra+Macarambon&background=10b981&color=fff'),
('2026-0049', 'amrieljhairene.nunez@g.msuiit.edu.ph', '1234', 'Amriel Jhairene Nunez', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Amriel+Jhairene+Nunez&background=059669&color=fff'),
('2026-0050', 'daniel.padua@g.msuiit.edu.ph', '1234', 'Daniel Padua', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Daniel+Padua&background=10b981&color=fff'),
('2026-0051', 'candiceandrei.pagarigan@g.msuiit.edu.ph', '1234', 'Candice Andrei Pagarigan', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Candice+Andrei+Pagarigan&background=059669&color=fff'),
('2026-0052', 'joshuavince.panerio@g.msuiit.edu.ph', '1234', 'Joshua Vince Panerio', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Joshua+Vince+Panerio&background=10b981&color=fff'),
('2026-0053', 'jayne.pepito@g.msuiit.edu.ph', '1234', 'Jayne Pepito', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Jayne+Pepito&background=059669&color=fff'),
('2026-0054', 'lykashannel.rabe@g.msuiit.edu.ph', '1234', 'Lyka Shannel Rabe', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Lyka+Shannel+Rabe&background=10b981&color=fff'),
('2026-0055', 'jeanfissoferra.ronquillo@g.msuiit.edu.ph', '1234', 'Jeanfiso Ferna Ronquillo', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Jeanfiso+Ferna+Ronquillo&background=059669&color=fff'),
('2026-0056', 'gabriel.sacay@g.msuiit.edu.ph', '1234', 'Gabriel Sacay', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Gabriel+Sacay&background=10b981&color=fff'),
('2026-0057', 'marljoshen.salvador@g.msuiit.edu.ph', '1234', 'Marl Joshen Salvador', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Marl+Joshen+Salvador&background=059669&color=fff'),
('2026-0058', 'princesssavanna.tantao@g.msuiit.edu.ph', '1234', 'Princess Savanna Tantao', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Princess+Savanna+Tantao&background=10b981&color=fff'),
('2026-0059', 'aqeelmuhajer.tocalo@g.msuiit.edu.ph', '1234', 'Aqeel Muhajer Tocalo', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Aqeel+Muhajer+Tocalo&background=059669&color=fff'),
('2026-0060', 'ethananthony.ubanan@g.msuiit.edu.ph', '1234', 'Ethan Anthony Ubanan', 'student', NULL, 10, 'Phi', 'https://ui-avatars.com/api/?name=Ethan+Anthony+Ubanan&background=10b981&color=fff');

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ GRADE 10 - SIGMA (Adviser: Everlita E. Canalita) — 31 students         │
-- └──────────────────────────────────────────────────────────────────────────┘
INSERT INTO public.profiles (student_id, email, pin, full_name, role, rfid_uid, grade_level, section, avatar_url) VALUES
('2026-0061', 'marjun.abadano@g.msuiit.edu.ph', '1234', 'Marjun Abadano', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Marjun+Abadano&background=dc2626&color=fff'),
('2026-0062', 'shiekajannahyry.abulkhair@g.msuiit.edu.ph', '1234', 'Shieka Jannahyry Abulkhair', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Shieka+Jannahyry+Abulkhair&background=ef4444&color=fff'),
('2026-0063', 'susainekyle.aguaviva@g.msuiit.edu.ph', '1234', 'Susaine Kyle Aguaviva', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Susaine+Kyle+Aguaviva&background=dc2626&color=fff'),
('2026-0064', 'ryonaciedelle.alibanggo@g.msuiit.edu.ph', '1234', 'Ryona Ciedelle Alibanggo', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Ryona+Ciedelle+Alibanggo&background=ef4444&color=fff'),
('2026-0065', 'rainthirdy.arago@g.msuiit.edu.ph', '1234', 'Rain Thirdy Arago', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Rain+Thirdy+Arago&background=dc2626&color=fff'),
('2026-0066', 'calvin.asibal@g.msuiit.edu.ph', '1234', 'Calvin Asibal', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Calvin+Asibal&background=ef4444&color=fff'),
('2026-0067', 'macrandall.batara@g.msuiit.edu.ph', '1234', 'Mac Randall Batara', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Mac+Randall+Batara&background=dc2626&color=fff'),
('2026-0068', 'jecel.bolo@g.msuiit.edu.ph', '1234', 'Jecel Bolo', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Jecel+Bolo&background=ef4444&color=fff'),
('2026-0069', 'janneiahaunisse.bugay@g.msuiit.edu.ph', '1234', 'Janneiah Aunisse Bugay', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Janneiah+Aunisse+Bugay&background=dc2626&color=fff'),
('2026-0070', 'janninemei.dayoc@g.msuiit.edu.ph', '1234', 'Jannine Mei Dayoc', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Jannine+Mei+Dayoc&background=ef4444&color=fff'),
('2026-0071', 'chancesmianne.emano@g.msuiit.edu.ph', '1234', 'Chances Mianne Emano', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Chances+Mianne+Emano&background=dc2626&color=fff'),
('2026-0072', 'ryanrico.espinosa@g.msuiit.edu.ph', '1234', 'Ryan Rico Espinosa', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Ryan+Rico+Espinosa&background=ef4444&color=fff'),
('2026-0073', 'gemcarl.fuentes@g.msuiit.edu.ph', '1234', 'Gem Carl Fuentes', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Gem+Carl+Fuentes&background=dc2626&color=fff'),
('2026-0074', 'krizzel.hynson@g.msuiit.edu.ph', '1234', 'Krizzel Hynson', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Krizzel+Hynson&background=ef4444&color=fff'),
('2026-0075', 'vincecarlo.labanan@g.msuiit.edu.ph', '1234', 'Vince Carlo Labanan', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Vince+Carlo+Labanan&background=dc2626&color=fff'),
('2026-0076', 'wellaandrea.lapat@g.msuiit.edu.ph', '1234', 'Wella Andrea Lapat', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Wella+Andrea+Lapat&background=ef4444&color=fff'),
('2026-0077', 'lancematthew.llanes@g.msuiit.edu.ph', '1234', 'Lance Matthew Llanes', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Lance+Matthew+Llanes&background=dc2626&color=fff'),
('2026-0078', 'davongrey.loberanes@g.msuiit.edu.ph', '1234', 'Davon Grey Loberanes', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Davon+Grey+Loberanes&background=ef4444&color=fff'),
('2026-0079', 'lovelyshane.maglangit@g.msuiit.edu.ph', '1234', 'Lovely Shane Maglangit', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Lovely+Shane+Maglangit&background=dc2626&color=fff'),
('2026-0080', 'zahirimran.mindalano@g.msuiit.edu.ph', '1234', 'Zahir Imran Mindalano', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Zahir+Imran+Mindalano&background=ef4444&color=fff'),
('2026-0081', 'sheemazareena.moamar@g.msuiit.edu.ph', '1234', 'Sheema Zareena Moamar', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Sheema+Zareena+Moamar&background=dc2626&color=fff'),
('2026-0082', 'chloe.naldo@g.msuiit.edu.ph', '1234', 'Chloe Naldo', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Chloe+Naldo&background=ef4444&color=fff'),
('2026-0083', 'celomarjr.paquiao@g.msuiit.edu.ph', '1234', 'Celomar Jr. Paquiao', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Celomar+Paquiao&background=dc2626&color=fff'),
('2026-0084', 'princepatrick.parami@g.msuiit.edu.ph', '1234', 'Prince Patrick Parami', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Prince+Patrick+Parami&background=ef4444&color=fff'),
('2026-0085', 'zaheer.pasandalan@g.msuiit.edu.ph', '1234', 'Zaheer Pasandalan', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Zaheer+Pasandalan&background=dc2626&color=fff'),
('2026-0086', 'chrisiarhe.ramil@g.msuiit.edu.ph', '1234', 'Chrisia Rhe Ramil', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Chrisia+Rhe+Ramil&background=ef4444&color=fff'),
('2026-0087', 'gabrielle.reyes@g.msuiit.edu.ph', '1234', 'Gabrielle Xavi Reyes', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Gabrielle+Xavi+Reyes&background=dc2626&color=fff'),
('2026-0088', 'maryallyza.roque@g.msuiit.edu.ph', '1234', 'Mary Allyza Roque', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Mary+Allyza+Roque&background=ef4444&color=fff'),
('2026-0089', 'kaellahdanielle.roxas@g.msuiit.edu.ph', '1234', 'Kaellah Danielle Roxas', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Kaellah+Danielle+Roxas&background=dc2626&color=fff'),
('2026-0090', 'sittieameena.solaiman@g.msuiit.edu.ph', '1234', 'Sittie Ameena Solaiman', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Sittie+Ameena+Solaiman&background=ef4444&color=fff'),
('2026-0091', 'lorainejulia.sumagang@g.msuiit.edu.ph', '1234', 'Loraine Julia Sumagang', 'student', NULL, 10, 'Sigma', 'https://ui-avatars.com/api/?name=Loraine+Julia+Sumagang&background=dc2626&color=fff');

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ GRADE 10 - TAU (Adviser: Gilden Maecah M. Migalang) — 30 students      │
-- └──────────────────────────────────────────────────────────────────────────┘
INSERT INTO public.profiles (student_id, email, pin, full_name, role, rfid_uid, grade_level, section, avatar_url) VALUES
('2026-0092', 'ceanaxavia.adeva@g.msuiit.edu.ph', '1234', 'Ceana Xavia Adeva', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Ceana+Xavia+Adeva&background=ea580c&color=fff'),
('2026-0093', 'mohammadryan.ampang@g.msuiit.edu.ph', '1234', 'Mohammad Ryan Ampang', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Mohammad+Ryan+Ampang&background=f97316&color=fff'),
('2026-0094', 'seinmikeljames.aquino@g.msuiit.edu.ph', '1234', 'Sein Mikel James Aquino', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Sein+Mikel+James+Aquino&background=ea580c&color=fff'),
('2026-0095', 'gianniexielo.arquillos@g.msuiit.edu.ph', '1234', 'Gianne Xielo Arquillos', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Gianne+Xielo+Arquillos&background=f97316&color=fff'),
('2026-0096', 'johngabriel.arteta@g.msuiit.edu.ph', '1234', 'John Gabriel Arteta', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=John+Gabriel+Arteta&background=ea580c&color=fff'),
('2026-0097', 'josephlevi.baclaan@g.msuiit.edu.ph', '1234', 'Joseph Levi Baclaan', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Joseph+Levi+Baclaan&background=f97316&color=fff'),
('2026-0098', 'shahannelea.bagro@g.msuiit.edu.ph', '1234', 'Shahanne Lea Bagro', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Shahanne+Lea+Bagro&background=ea580c&color=fff'),
('2026-0099', 'aarongabriel.banaag@g.msuiit.edu.ph', '1234', 'Aaron Gabriel Banaag', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Aaron+Gabriel+Banaag&background=f97316&color=fff'),
('2026-0100', 'karlajoycemenissa.benitez@g.msuiit.edu.ph', '1234', 'Karla Joyce Melissa Benitez', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Karla+Joyce+Melissa+Benitez&background=ea580c&color=fff'),
('2026-0101', 'deonnealexa.cabtalan@g.msuiit.edu.ph', '1234', 'Deonne Alexa Cabtalan', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Deonne+Alexa+Cabtalan&background=f97316&color=fff'),
('2026-0102', 'hanniel.canete@g.msuiit.edu.ph', '1234', 'Hanniel Cañete', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Hanniel+Canete&background=ea580c&color=fff'),
('2026-0103', 'makaylasophie.caunda@g.msuiit.edu.ph', '1234', 'Makayla Sophie Caunda', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Makayla+Sophie+Caunda&background=f97316&color=fff'),
('2026-0104', 'kristianmikael.cuanan@g.msuiit.edu.ph', '1234', 'Kristian Mikael Cuanan', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Kristian+Mikael+Cuanan&background=ea580c&color=fff'),
('2026-0105', 'juanmiguel.dionesio@g.msuiit.edu.ph', '1234', 'Juan Miguel Dionesio', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Juan+Miguel+Dionesio&background=f97316&color=fff'),
('2026-0106', 'janfaithmarguax.florentin@g.msuiit.edu.ph', '1234', 'Jan Faith Marguax Florentin', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Jan+Faith+Marguax+Florentin&background=ea580c&color=fff'),
('2026-0107', 'gleenpatrick.fuentes@g.msuiit.edu.ph', '1234', 'Gleen Patrick Fuentes', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Gleen+Patrick+Fuentes&background=f97316&color=fff'),
('2026-0108', 'ahmadsadat.lanto@g.msuiit.edu.ph', '1234', 'Ahmadsadat Lanto', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Ahmadsadat+Lanto&background=ea580c&color=fff'),
('2026-0109', 'isaiah.lluisma@g.msuiit.edu.ph', '1234', 'Isaiah Lluisma', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Isaiah+Lluisma&background=f97316&color=fff'),
('2026-0110', 'cjcarmonynyl.lopez@g.msuiit.edu.ph', '1234', 'CJ Carmelo Nyl Lopez', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=CJ+Carmelo+Nyl+Lopez&background=ea580c&color=fff'),
('2026-0111', 'mohamadrashid.lucman@g.msuiit.edu.ph', '1234', 'Mohammad Rashid Lucman', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Mohammad+Rashid+Lucman&background=f97316&color=fff'),
('2026-0112', 'billyjohnwel.mapula@g.msuiit.edu.ph', '1234', 'Billy Johnwel Mapula', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Billy+Johnwel+Mapula&background=ea580c&color=fff'),
('2026-0113', 'lyanacorraine.merto@g.msuiit.edu.ph', '1234', 'Lyana Corrine Merto', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Lyana+Corrine+Merto&background=f97316&color=fff'),
('2026-0114', 'raniatujannah.mohamad@g.msuiit.edu.ph', '1234', 'Raniatu-Jannah Mohamad', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Raniatu+Jannah+Mohamad&background=ea580c&color=fff'),
('2026-0115', 'cherrymae.palubon@g.msuiit.edu.ph', '1234', 'Cherry Mae Palubon', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Cherry+Mae+Palubon&background=f97316&color=fff'),
('2026-0116', 'johnyssa.pusod@g.msuiit.edu.ph', '1234', 'Johnyssa Pusod', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Johnyssa+Pusod&background=ea580c&color=fff'),
('2026-0117', 'denisemikhyla.raiz@g.msuiit.edu.ph', '1234', 'Denise Mikhyla Raiz', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Denise+Mikhyla+Raiz&background=f97316&color=fff'),
('2026-0118', 'maryalicia.silva@g.msuiit.edu.ph', '1234', 'Mary Alicia Silva', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Mary+Alicia+Silva&background=ea580c&color=fff'),
('2026-0119', 'alexiequeen.suminguit@g.msuiit.edu.ph', '1234', 'Alexie Queen Suminguit', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Alexie+Queen+Suminguit&background=f97316&color=fff'),
('2026-0120', 'christiannibiel.villaruz@g.msuiit.edu.ph', '1234', 'Christianni Biel Villaruz', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Christianni+Biel+Villaruz&background=ea580c&color=fff'),
('2026-0121', 'aiman.yahya@g.msuiit.edu.ph', '1234', 'Aiman Yahya', 'student', NULL, 10, 'Tau', 'https://ui-avatars.com/api/?name=Aiman+Yahya&background=f97316&color=fff');

-- ── Enroll ALL students in IT10 ──────────────────────────────────────────────
INSERT INTO public.enrollments (student_id, course_id)
SELECT p.id, c.id FROM public.profiles p, public.courses c
WHERE c.code = 'IT10' AND p.role = 'student';

-- ── Admin profile (needed as announcement author) ──────────────────────────
INSERT INTO public.profiles (id, student_id, email, pin, full_name, role, rfid_uid, avatar_url, grade_level, section) VALUES
('a0000000-0000-4000-8000-000000000001', NULL, 'ana.reyes@northview.edu', '0000', 'Ana Reyes', 'admin', NULL, 'https://ui-avatars.com/api/?name=Ana+Reyes&background=dc2626&color=fff', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Announcements ───────────────────────────────────────────────────────────
INSERT INTO public.announcements (id, title, content, category, target_audience, author_id, created_at) VALUES
('aa000000-0000-4000-8000-000000000001', 'Classes Suspended Tomorrow Due to Typhoon Signal', 'Per the advisory from the city government, all classes and office work are suspended tomorrow. Stay safe and monitor official channels for updates.', 'urgent', 'all', 'a0000000-0000-4000-8000-000000000001', NOW() - INTERVAL '2 hours'),
('aa000000-0000-4000-8000-000000000002', 'Second Quarter Exam Schedule Released', 'The examination schedule for the second quarter is now posted on the registrar''s bulletin board. Exams run from September 7-11. Review your permits early.', 'academic', 'students', 'b0000000-0000-4000-8000-000000000003', NOW() - INTERVAL '1 day'),
('aa000000-0000-4000-8000-000000000003', 'Intramurals 2026: Opening Parade This Friday', 'All sections must assemble at the quadrangle by 6:30 AM in complete team uniforms. Attendance will be checked per section.', 'event', 'all', 'a0000000-0000-4000-8000-000000000001', NOW() - INTERVAL '2 days'),
('aa000000-0000-4000-8000-000000000004', 'Robotics Club Meeting This Wednesday', 'All Grade 10 IT students are invited to the first Robotics Club meeting this Wednesday after class in Room 305. Bring your notebooks.', 'academic', 'students', 'b0000000-0000-4000-8000-000000000003', NOW() - INTERVAL '3 days');
