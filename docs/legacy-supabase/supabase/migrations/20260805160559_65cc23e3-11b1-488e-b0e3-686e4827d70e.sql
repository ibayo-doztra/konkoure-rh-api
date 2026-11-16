-- Helper: recruitment staff (owner / hr_admin / recruiter / manager)
CREATE OR REPLACE FUNCTION private.is_recruitment_staff(_user uuid, _org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = _user
       AND ur.organization_id = _org
       AND ur.role IN ('owner','hr_admin','recruiter','manager')
  );
$$;

REVOKE ALL ON FUNCTION private.is_recruitment_staff(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ============ candidate_notes ============
DROP POLICY IF EXISTS "candidate_notes: members read" ON public.candidate_notes;
CREATE POLICY "candidate_notes: recruitment read"
ON public.candidate_notes FOR SELECT TO authenticated
USING (
  private.is_recruitment_staff(auth.uid(), organization_id)
  OR auth.uid() = author_id
);

DROP POLICY IF EXISTS "candidate_notes: members write" ON public.candidate_notes;
CREATE POLICY "candidate_notes: recruitment write"
ON public.candidate_notes FOR INSERT TO authenticated
WITH CHECK (
  private.is_recruitment_staff(auth.uid(), organization_id)
  AND auth.uid() = author_id
);

-- ============ candidates ============
DROP POLICY IF EXISTS "Candidates: members read" ON public.candidates;
CREATE POLICY "Candidates: recruitment read"
ON public.candidates FOR SELECT TO authenticated
USING (private.is_recruitment_staff(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Candidates: members update" ON public.candidates;
CREATE POLICY "Candidates: recruitment update"
ON public.candidates FOR UPDATE TO authenticated
USING (private.is_recruitment_staff(auth.uid(), organization_id))
WITH CHECK (private.is_recruitment_staff(auth.uid(), organization_id));

-- ============ departments ============
DROP POLICY IF EXISTS "departments: members write" ON public.departments;
CREATE POLICY "departments: admins write"
ON public.departments FOR INSERT TO authenticated
WITH CHECK (private.is_org_admin(auth.uid(), organization_id));

-- ============ skills ============
DROP POLICY IF EXISTS "skills: members write" ON public.skills;
CREATE POLICY "skills: admins write"
ON public.skills FOR INSERT TO authenticated
WITH CHECK (private.is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "skills: members update" ON public.skills;
CREATE POLICY "skills: admins update"
ON public.skills FOR UPDATE TO authenticated
USING (private.is_org_admin(auth.uid(), organization_id))
WITH CHECK (private.is_org_admin(auth.uid(), organization_id));

-- ============ work_zones ============
DROP POLICY IF EXISTS "work_zones: members write" ON public.work_zones;
CREATE POLICY "work_zones: admins write"
ON public.work_zones FOR INSERT TO authenticated
WITH CHECK (private.is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "work_zones: members update" ON public.work_zones;
CREATE POLICY "work_zones: admins update"
ON public.work_zones FOR UPDATE TO authenticated
USING (private.is_org_admin(auth.uid(), organization_id))
WITH CHECK (private.is_org_admin(auth.uid(), organization_id));

-- ============ succession_plans ============
DROP POLICY IF EXISTS "succession_plans: members write" ON public.succession_plans;
CREATE POLICY "succession_plans: admins write"
ON public.succession_plans FOR INSERT TO authenticated
WITH CHECK (private.is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "succession_plans: members update" ON public.succession_plans;
CREATE POLICY "succession_plans: admins update"
ON public.succession_plans FOR UPDATE TO authenticated
USING (private.is_org_admin(auth.uid(), organization_id))
WITH CHECK (private.is_org_admin(auth.uid(), organization_id));

-- ============ social_posts ============
DROP POLICY IF EXISTS "social_posts: members write" ON public.social_posts;
CREATE POLICY "social_posts: recruitment write"
ON public.social_posts FOR INSERT TO authenticated
WITH CHECK (private.is_recruitment_staff(auth.uid(), organization_id));

DROP POLICY IF EXISTS "social_posts: members update" ON public.social_posts;
CREATE POLICY "social_posts: recruitment update"
ON public.social_posts FOR UPDATE TO authenticated
USING (private.is_recruitment_staff(auth.uid(), organization_id))
WITH CHECK (private.is_recruitment_staff(auth.uid(), organization_id));

-- ============ goals ============
DROP POLICY IF EXISTS "goals: members write" ON public.goals;
CREATE POLICY "goals: scoped write"
ON public.goals FOR INSERT TO authenticated
WITH CHECK (
  private.is_org_admin(auth.uid(), organization_id)
  OR (employee_id IS NOT NULL AND (
        private.is_self_employee(auth.uid(), employee_id)
        OR private.is_employee_manager(auth.uid(), employee_id)
     ))
  OR (owner_id IS NOT NULL AND (
        private.is_self_employee(auth.uid(), owner_id)
        OR private.is_employee_manager(auth.uid(), owner_id)
     ))
);

DROP POLICY IF EXISTS "goals: members update" ON public.goals;
CREATE POLICY "goals: scoped update"
ON public.goals FOR UPDATE TO authenticated
USING (
  private.is_org_admin(auth.uid(), organization_id)
  OR (employee_id IS NOT NULL AND (
        private.is_self_employee(auth.uid(), employee_id)
        OR private.is_employee_manager(auth.uid(), employee_id)
     ))
  OR (owner_id IS NOT NULL AND (
        private.is_self_employee(auth.uid(), owner_id)
        OR private.is_employee_manager(auth.uid(), owner_id)
     ))
)
WITH CHECK (
  private.is_org_admin(auth.uid(), organization_id)
  OR (employee_id IS NOT NULL AND (
        private.is_self_employee(auth.uid(), employee_id)
        OR private.is_employee_manager(auth.uid(), employee_id)
     ))
  OR (owner_id IS NOT NULL AND (
        private.is_self_employee(auth.uid(), owner_id)
        OR private.is_employee_manager(auth.uid(), owner_id)
     ))
);