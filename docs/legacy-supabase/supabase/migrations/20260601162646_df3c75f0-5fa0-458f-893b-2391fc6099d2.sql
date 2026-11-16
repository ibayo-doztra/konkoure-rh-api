-- Add plan_id and manager evaluation columns to performance_reviews
ALTER TABLE public.performance_reviews
  ADD COLUMN IF NOT EXISTS plan_id uuid,
  ADD COLUMN IF NOT EXISTS manager_score integer,
  ADD COLUMN IF NOT EXISTS manager_global_comment text,
  ADD COLUMN IF NOT EXISTS manager_submitted_at timestamptz;

ALTER TABLE public.performance_reviews ALTER COLUMN cycle_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS performance_reviews_plan_employee_unique
  ON public.performance_reviews (organization_id, plan_id, employee_id)
  WHERE plan_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reviews_require_plan_or_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.plan_id IS NULL AND NEW.cycle_id IS NULL THEN
    RAISE EXCEPTION 'Une évaluation doit être rattachée à un plan de performance (plan_id)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_require_plan_or_cycle_trg ON public.performance_reviews;
CREATE TRIGGER reviews_require_plan_or_cycle_trg
  BEFORE INSERT OR UPDATE ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_require_plan_or_cycle();

-- Manager comment on per-goal review comments
ALTER TABLE public.review_goal_comments
  ADD COLUMN IF NOT EXISTS manager_comment text;