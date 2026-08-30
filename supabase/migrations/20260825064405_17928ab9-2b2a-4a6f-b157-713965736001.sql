ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;

CREATE INDEX IF NOT EXISTS profiles_active_idx ON public.profiles (role) WHERE deleted_at IS NULL;