ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_id text,
  ADD COLUMN IF NOT EXISTS prefix text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS biometric_enrolled_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_face_enrolled boolean GENERATED ALWAYS AS (face_embedding IS NOT NULL) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_employee_id_active_key
  ON public.profiles (lower(employee_id)) WHERE employee_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_rfid_uid_active_key
  ON public.profiles (rfid_uid) WHERE rfid_uid IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_active_key
  ON public.profiles (lower(email)) WHERE email IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'pin',
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS confidence_score numeric;

ALTER TABLE public.attendance_logs DROP CONSTRAINT IF EXISTS attendance_logs_auth_method_check;
ALTER TABLE public.attendance_logs
  ADD CONSTRAINT attendance_logs_auth_method_check
  CHECK (auth_method IN ('rfid', 'web_face', 'hardware_face', 'pin'));