ALTER TABLE public.goals
  ADD CONSTRAINT goals_end_after_start_check
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
  NOT VALID;