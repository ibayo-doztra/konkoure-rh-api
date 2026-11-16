
CREATE TYPE public.perf_plan_status AS ENUM ('draft', 'active', 'closed');

CREATE TABLE public.performance_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status public.perf_plan_status NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_plans TO authenticated;
GRANT ALL ON public.performance_plans TO service_role;

ALTER TABLE public.performance_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans: members read" ON public.performance_plans
  FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "plans: admins write" ON public.performance_plans
  FOR INSERT WITH CHECK (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "plans: admins update" ON public.performance_plans
  FOR UPDATE USING (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "plans: admins delete" ON public.performance_plans
  FOR DELETE USING (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER trg_perf_plans_updated_at
  BEFORE UPDATE ON public.performance_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.goals ADD COLUMN plan_id uuid;
CREATE INDEX idx_goals_plan_id ON public.goals(plan_id);
