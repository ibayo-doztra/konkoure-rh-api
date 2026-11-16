-- 1) Modèle de performance par organisation
DO $$ BEGIN
  CREATE TYPE public.performance_model AS ENUM ('classic', 'sap');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS performance_model public.performance_model NOT NULL DEFAULT 'classic';

-- 2) Enums SAP
DO $$ BEGIN
  CREATE TYPE public.goal_category AS ENUM ('business', 'development', 'behavioral');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.goal_status AS ENUM ('active', 'achieved', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.goal_activity_status AS ENUM ('planned', 'in_progress', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Goals
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid,
  parent_goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category public.goal_category NOT NULL DEFAULT 'business',
  weight integer NOT NULL DEFAULT 100 CHECK (weight BETWEEN 1 AND 100),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status public.goal_status NOT NULL DEFAULT 'active',
  start_date date,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals: members read" ON public.goals FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "goals: members write" ON public.goals FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "goals: members update" ON public.goals FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "goals: admins delete" ON public.goals FOR DELETE
  USING (is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER goals_set_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Goal activities
CREATE TABLE IF NOT EXISTS public.goal_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  employee_id uuid,
  title text NOT NULL,
  description text,
  status public.goal_activity_status NOT NULL DEFAULT 'planned',
  planned_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_activities TO authenticated;
GRANT ALL ON public.goal_activities TO service_role;

ALTER TABLE public.goal_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_activities: members read" ON public.goal_activities FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "goal_activities: members write" ON public.goal_activities FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "goal_activities: members update" ON public.goal_activities FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "goal_activities: admins delete" ON public.goal_activities FOR DELETE
  USING (is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER goal_activities_set_updated_at BEFORE UPDATE ON public.goal_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Achievements
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  employee_id uuid,
  title text NOT NULL,
  description text,
  impact text,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievements: members read" ON public.achievements FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "achievements: members write" ON public.achievements FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));
CREATE POLICY "achievements: members update" ON public.achievements FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));
CREATE POLICY "achievements: admins delete" ON public.achievements FOR DELETE
  USING (is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER achievements_set_updated_at BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_goals_org ON public.goals(organization_id);
CREATE INDEX IF NOT EXISTS idx_goal_activities_goal ON public.goal_activities(goal_id);
CREATE INDEX IF NOT EXISTS idx_achievements_org ON public.achievements(organization_id);