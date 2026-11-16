-- 1) Anonymous exposure of organizations
DROP POLICY IF EXISTS "Orgs: anon read public profile" ON public.organizations;
REVOKE ALL (id, name, slug, logo_url) ON public.organizations FROM anon;
REVOKE ALL ON public.organizations FROM anon;

CREATE OR REPLACE VIEW public.organizations_public
WITH (security_invoker = false) AS
  SELECT id, name, slug, logo_url
  FROM public.organizations
  WHERE slug IS NOT NULL;

GRANT SELECT ON public.organizations_public TO anon, authenticated;

-- 2) Feedback author impersonation
DROP POLICY IF EXISTS "feedbacks: members write" ON public.feedbacks;
CREATE POLICY "feedbacks: author write" ON public.feedbacks
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_org_member(auth.uid(), organization_id)
    AND (
      private.is_org_admin(auth.uid(), organization_id)
      OR private.is_self_employee(auth.uid(), from_employee_id)
    )
  );

-- 3) Org bootstrap race condition
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

UPDATE public.organizations o
   SET created_by = ur.user_id
  FROM public.user_roles ur
 WHERE ur.organization_id = o.id
   AND ur.role = 'owner'
   AND o.created_by IS NULL;

DROP POLICY IF EXISTS "Orgs: authenticated create" ON public.organizations;
CREATE POLICY "Orgs: authenticated create" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

DROP POLICY IF EXISTS "Members: self bootstrap first" ON public.organization_members;
CREATE POLICY "Members: self bootstrap first" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.organizations o
       WHERE o.id = organization_members.organization_id
         AND o.created_by = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_members existing
       WHERE existing.organization_id = organization_members.organization_id
    )
  );

DROP POLICY IF EXISTS "Roles: self bootstrap first owner" ON public.user_roles;
CREATE POLICY "Roles: self bootstrap first owner" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'owner'::app_role
    AND EXISTS (
      SELECT 1 FROM public.organizations o
       WHERE o.id = user_roles.organization_id
         AND o.created_by = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles existing
       WHERE existing.organization_id = user_roles.organization_id
    )
  );