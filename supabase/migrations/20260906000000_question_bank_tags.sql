-- Question Bank Tags: add bank_id to quiz_questions for per-student randomization tracking

-- Add bank_id column (e.g. "QB_001", "QB_002")
ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS bank_id text;

-- Backfill existing questions based on their position within each quiz
UPDATE public.quiz_questions q
SET bank_id = 'QB_' || LPAD(q.position::text, 3, '0')
WHERE q.bank_id IS NULL;

-- Now safe to add NOT NULL constraint
ALTER TABLE public.quiz_questions
  ALTER COLUMN bank_id SET NOT NULL;

-- Default for new inserts (will be overridden by app logic, but safety net)
ALTER TABLE public.quiz_questions
  ALTER COLUMN bank_id SET DEFAULT 'QB_000';
