
-- Enums
DO $$ BEGIN
  CREATE TYPE public.perf_cycle_frequency AS ENUM ('annual','semestrial','quarterly','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.perf_cycle_status AS ENUM ('draft','open','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.perf_review_status AS ENUM ('not_started','in_progress','submitted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend existing goal_status enum with SuccessFactors statuses
ALTER TYPE public.goal_status ADD VALUE IF NOT EXISTS 'not_started';
ALTER TYPE public.goal_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE public.goal_status ADD VALUE IF NOT EXISTS 'late';

-- =========== performance_cycles ===========
CREATE TABLE IF NOT EXISTS public.performance_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  frequency public.perf_cycle_frequency NOT NULL DEFAULT 'annual',
  period_start date NOT NULL,
  period_end date NOT NULL,
  self_eval_opens_at timestamptz,
  self_eval_closes_at timestamptz,
  status public.perf_cycle_status NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_cycles TO authenticated;
GRANT ALL ON public.performance_cycles TO service_role;

ALTER TABLE public.performance_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cycles: members read" ON public.performance_cycles FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "cycles: admins write" ON public.performance_cycles FOR INSERT WITH CHECK (is_org_admin(auth.uid(), organization_id));
CREATE POLICY "cycles: admins update" ON public.performance_cycles FOR UPDATE USING (is_org_admin(auth.uid(), organization_id));
CREATE POLICY "cycles: admins delete" ON public.performance_cycles FOR DELETE USING (is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER perf_cycles_updated_at BEFORE UPDATE ON public.performance_cycles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== performance_reviews ===========
CREATE TABLE IF NOT EXISTS public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  cycle_id uuid NOT NULL REFERENCES public.performance_cycles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  manager_id uuid,
  status public.perf_review_status NOT NULL DEFAULT 'not_started',
  self_global_comment text,
  self_score int CHECK (self_score IS NULL OR (self_score BETWEEN 1 AND 5)),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, employee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_reviews TO authenticated;
GRANT ALL ON public.performance_reviews TO service_role;

ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "previews: members read" ON public.performance_reviews FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "previews: members write" ON public.performance_reviews FOR INSERT WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "previews: members update" ON public.performance_reviews FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "previews: admins delete" ON public.performance_reviews FOR DELETE USING (is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER perf_reviews_updated_at BEFORE UPDATE ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_previews_cycle ON public.performance_reviews(cycle_id);
CREATE INDEX IF NOT EXISTS idx_previews_employee ON public.performance_reviews(employee_id);

-- =========== review_goal_comments ===========
CREATE TABLE IF NOT EXISTS public.review_goal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  review_id uuid NOT NULL REFERENCES public.performance_reviews(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  self_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, goal_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_goal_comments TO authenticated;
GRANT ALL ON public.review_goal_comments TO service_role;

ALTER TABLE public.review_goal_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rgc: members read" ON public.review_goal_comments FOR SELECT USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "rgc: members write" ON public.review_goal_comments FOR INSERT WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "rgc: members update" ON public.review_goal_comments FOR UPDATE USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "rgc: admins delete" ON public.review_goal_comments FOR DELETE USING (is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER rgc_updated_at BEFORE UPDATE ON public.review_goal_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== notifications ===========
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif: read own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif: update own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif: members insert" ON public.notifications FOR INSERT WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "notif: admins delete" ON public.notifications FOR DELETE USING (is_org_admin(auth.uid(), organization_id));

CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON public.notifications(user_id, read_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =========== goals enrichment ===========
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS measurement text;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS created_by_id uuid;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS review_id uuid REFERENCES public.performance_reviews(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_goals_review ON public.goals(review_id);
CREATE INDEX IF NOT EXISTS idx_goals_owner ON public.goals(owner_id);
