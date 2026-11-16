ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS ai_strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_is_valid_cv boolean,
  ADD COLUMN IF NOT EXISTS ai_fraud_alert boolean,
  ADD COLUMN IF NOT EXISTS ai_candidate_name text,
  ADD COLUMN IF NOT EXISTS ai_scored_at timestamptz;