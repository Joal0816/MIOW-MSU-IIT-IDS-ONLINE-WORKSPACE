-- Question Bank MVP: randomize questions per student attempt

-- Add question_count to quizzes (0 = show all, the current default behavior)
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS question_count integer NOT NULL DEFAULT 0;

-- Add question_ids to quiz_attempts (stores which questions were actually shown)
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS question_ids uuid[] NOT NULL DEFAULT '{}';
