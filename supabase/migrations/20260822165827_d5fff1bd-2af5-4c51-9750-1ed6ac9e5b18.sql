ALTER TYPE public.attendance_mark ADD VALUE IF NOT EXISTS 'excused';

ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;