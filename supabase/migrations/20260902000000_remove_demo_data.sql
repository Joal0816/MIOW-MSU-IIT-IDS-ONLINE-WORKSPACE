-- Production cleanup: remove all demo/seed data inserted by earlier migrations.
-- Schema (tables, types, policies) is preserved — only data is wiped.
-- Run AFTER all seed migrations have been applied.

-- Delete child records first (FK dependencies)
DELETE FROM public.grades;
DELETE FROM public.submissions;
DELETE FROM public.quiz_questions;
DELETE FROM public.quizzes;
DELETE FROM public.assignments;
DELETE FROM public.enrollments;
DELETE FROM public.attendance_logs;
DELETE FROM public.announcements;
DELETE FROM public.chat_memories;
DELETE FROM public.submission_files;

-- Delete parent records
DELETE FROM public.courses;
DELETE FROM public.profiles;
