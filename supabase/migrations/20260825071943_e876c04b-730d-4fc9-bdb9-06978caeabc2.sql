ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locked_until timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- Seed the administrator credential. The password is stored ONLY as a bcrypt
-- hash (work factor 12); the plaintext never touches the database.
UPDATE public.profiles
SET username = 'schooladmin',
    password_hash = '$2b$12$ufGBbDVDKLfFMRd5ATKXLe8vouoKXyvbgncRVGYkHxJV1ZJUI0oGO',
    failed_login_attempts = 0,
    locked_until = NULL
WHERE email = 'ana.reyes@northview.edu'
  AND deleted_at IS NULL;