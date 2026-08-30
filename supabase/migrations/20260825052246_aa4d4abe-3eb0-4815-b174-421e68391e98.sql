CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS days_of_week text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS start_time time without time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_time time without time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS late_threshold_minutes integer NOT NULL DEFAULT 10;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_days_of_week_valid
  CHECK (days_of_week IS NULL OR days_of_week <@ ARRAY['mon','tue','wed','thu','fri','sat','sun']::text[]),
  ADD CONSTRAINT courses_late_threshold_range
  CHECK (late_threshold_minutes BETWEEN 0 AND 60),
  ADD CONSTRAINT courses_time_order
  CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pin_hash text DEFAULT NULL;