-- 1. Retake configuration on quizzes (worksheets in the UI)
ALTER TABLE public.quizzes
  ADD COLUMN allow_retake boolean NOT NULL DEFAULT false,
  ADD COLUMN max_attempts integer NOT NULL DEFAULT 1,
  ADD COLUMN retake_score_policy text NOT NULL DEFAULT 'highest_score';

ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_max_attempts_check CHECK (max_attempts >= 0),
  ADD CONSTRAINT quizzes_retake_policy_check CHECK (retake_score_policy IN ('highest_score', 'latest_attempt', 'average_score'));

-- 2. Attempt history (worksheet_submissions equivalent)
CREATE TABLE public.quiz_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL DEFAULT 1,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX quiz_attempts_quiz_student_idx ON public.quiz_attempts (quiz_id, student_id, attempt_number DESC);

GRANT SELECT, INSERT, DELETE ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (student_id = private.current_profile_id());

CREATE POLICY "Staff read all attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (private.current_profile_role() = ANY (ARRAY['teacher'::profile_role, 'admin'::profile_role]));

CREATE POLICY "Students record own attempts" ON public.quiz_attempts
  FOR INSERT TO authenticated
  WITH CHECK (student_id = private.current_profile_id());

CREATE POLICY "Staff delete attempts" ON public.quiz_attempts
  FOR DELETE TO authenticated
  USING (private.current_profile_role() = ANY (ARRAY['teacher'::profile_role, 'admin'::profile_role]));

-- 3. Per-student retake grants (teacher/admin override)
CREATE TABLE public.quiz_retake_grants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  extra_attempts integer NOT NULL DEFAULT 1,
  granted_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, student_id),
  CONSTRAINT quiz_retake_grants_extra_positive CHECK (extra_attempts > 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_retake_grants TO authenticated;
GRANT ALL ON public.quiz_retake_grants TO service_role;

ALTER TABLE public.quiz_retake_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own grants" ON public.quiz_retake_grants
  FOR SELECT TO authenticated
  USING (student_id = private.current_profile_id());

CREATE POLICY "Staff manage grants" ON public.quiz_retake_grants
  FOR ALL TO authenticated
  USING (private.current_profile_role() = ANY (ARRAY['teacher'::profile_role, 'admin'::profile_role]))
  WITH CHECK (private.current_profile_role() = ANY (ARRAY['teacher'::profile_role, 'admin'::profile_role]));