-- Remove facial recognition system from profiles and attendance.
-- Drops face_embedding, is_face_enrolled, biometric_enrolled_at columns.
-- Removes confidence_score and face auth methods from attendance_logs.

-- 1. Drop face-related columns from profiles (IF EXISTS for idempotency)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_face_enrolled;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS biometric_enrolled_at;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS face_embedding;

-- 2. Clean up attendance_logs: drop face-related columns and fix auth_method constraint
ALTER TABLE public.attendance_logs DROP COLUMN IF EXISTS confidence_score;

-- Update any rows that used face auth methods to 'rfid' (closest approximation)
UPDATE public.attendance_logs SET auth_method = 'rfid' WHERE auth_method IN ('web_face', 'hardware_face');

-- Replace the CHECK constraint to remove face methods
ALTER TABLE public.attendance_logs DROP CONSTRAINT IF EXISTS attendance_logs_auth_method_check;
ALTER TABLE public.attendance_logs
  ADD CONSTRAINT attendance_logs_auth_method_check
  CHECK (auth_method IN ('rfid', 'pin'));
