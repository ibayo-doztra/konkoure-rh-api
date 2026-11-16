-- 1. OKR review cycle columns
DO $$ BEGIN
  CREATE TYPE public.okr_review_status AS ENUM ('draft','pending','validated','needs_revision');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.okrs
  ADD COLUMN IF NOT EXISTS review_status public.okr_review_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_comment text,
  ADD COLUMN IF NOT EXISTS validated_by uuid;

-- 2. Check-ins table
CREATE TABLE IF NOT EXISTS public.okr_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  okr_id uuid NOT NULL REFERENCES public.okrs(id) ON DELETE CASCADE,
  author_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  message text NOT NULL,
  progress_snapshot integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.okr_checkins TO authenticated;
GRANT ALL ON public.okr_checkins TO service_role;

ALTER TABLE public.okr_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "okr_checkins: members read"
  ON public.okr_checkins FOR SELECT TO authenticated
  USING (private.is_org_member(auth.uid(), organization_id));

CREATE POLICY "okr_checkins: owner or manager insert"
  ON public.okr_checkins FOR INSERT TO authenticated
  WITH CHECK (
    private.is_org_member(auth.uid(), organization_id)
    AND private.is_self_employee(auth.uid(), author_employee_id)
    AND EXISTS (
      SELECT 1 FROM public.okrs o
      WHERE o.id = okr_id
        AND o.organization_id = okr_checkins.organization_id
        AND (
          private.is_org_admin(auth.uid(), o.organization_id)
          OR private.is_self_employee(auth.uid(), o.employee_id)
          OR private.is_employee_manager(auth.uid(), o.employee_id)
        )
    )
  );

CREATE POLICY "okr_checkins: author or admin update"
  ON public.okr_checkins FOR UPDATE TO authenticated
  USING (
    private.is_org_member(auth.uid(), organization_id)
    AND (private.is_org_admin(auth.uid(), organization_id) OR private.is_self_employee(auth.uid(), author_employee_id))
  )
  WITH CHECK (
    private.is_org_member(auth.uid(), organization_id)
    AND (private.is_org_admin(auth.uid(), organization_id) OR private.is_self_employee(auth.uid(), author_employee_id))
  );

CREATE POLICY "okr_checkins: author or admin delete"
  ON public.okr_checkins FOR DELETE TO authenticated
  USING (
    private.is_org_member(auth.uid(), organization_id)
    AND (private.is_org_admin(auth.uid(), organization_id) OR private.is_self_employee(auth.uid(), author_employee_id))
  );

CREATE POLICY "plan module gate"
  ON public.okr_checkins AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.org_has_module(organization_id, 'performance'))
  WITH CHECK (private.org_has_module(organization_id, 'performance'));

CREATE TRIGGER okr_checkins_set_updated_at
  BEFORE UPDATE ON public.okr_checkins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS okr_checkins_okr_id_idx ON public.okr_checkins(okr_id, created_at DESC);

-- 3. Feedback links
ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS okr_id uuid REFERENCES public.okrs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL;