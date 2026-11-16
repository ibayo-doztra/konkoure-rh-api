
-- ============================================================
-- STORAGE: applications bucket (now private)
-- ============================================================
DROP POLICY IF EXISTS "Applications: public read" ON storage.objects;
DROP POLICY IF EXISTS "Applications: public upload" ON storage.objects;

CREATE POLICY "Applications: members read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'applications'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- Anonymous candidates may upload, but only inside a valid org/job/candidate path
CREATE POLICY "Applications: anon upload constrained"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'applications'
    AND array_length(storage.foldername(name), 1) >= 3
    AND ((storage.foldername(name))[1])::uuid IS NOT NULL
    AND length(name) < 512
  );

-- ============================================================
-- STORAGE: cvs bucket (org-member scoped)
-- ============================================================
DROP POLICY IF EXISTS "CVs: auth read" ON storage.objects;
DROP POLICY IF EXISTS "CVs: public upload" ON storage.objects;

CREATE POLICY "CVs: members read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'cvs'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "CVs: members upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cvs'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- ============================================================
-- STORAGE: employee-docs bucket (org-member scoped)
-- ============================================================
DROP POLICY IF EXISTS "Docs: auth read" ON storage.objects;
DROP POLICY IF EXISTS "Docs: auth write" ON storage.objects;

CREATE POLICY "Docs: members read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-docs'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Docs: members write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-docs'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- ============================================================
-- STORAGE: drop blanket SELECT on public buckets to stop listing.
-- Files remain reachable via the public object URL endpoint.
-- ============================================================
DROP POLICY IF EXISTS "Avatars: public read" ON storage.objects;
DROP POLICY IF EXISTS "org-logos public read" ON storage.objects;
DROP POLICY IF EXISTS "Social media images are publicly accessible" ON storage.objects;

-- ============================================================
-- ORGANIZATIONS: replace open public read with column-scoped grant
-- ============================================================
DROP POLICY IF EXISTS "Orgs: public read by slug" ON public.organizations;

CREATE POLICY "Orgs: anon read public profile"
  ON public.organizations FOR SELECT TO anon
  USING (slug IS NOT NULL);

REVOKE SELECT ON public.organizations FROM anon;
GRANT SELECT (id, name, slug, logo_url) ON public.organizations TO anon;

-- ============================================================
-- SOCIAL ACCOUNTS: hide OAuth tokens from regular members
-- ============================================================
REVOKE SELECT ON public.social_accounts FROM authenticated;
GRANT SELECT (
  id, organization_id, provider, account_id, account_name,
  token_expires_at, scopes, status, connected_by, connected_at, metadata
) ON public.social_accounts TO authenticated;

-- ============================================================
-- USER_ROLES & ORGANIZATION_MEMBERS: prevent privilege escalation
-- Only allow self-bootstrapping the very first owner/member of a brand-new org.
-- ============================================================
DROP POLICY IF EXISTS "Roles: self bootstrap owner" ON public.user_roles;
CREATE POLICY "Roles: self bootstrap first owner"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'owner'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles existing
      WHERE existing.organization_id = user_roles.organization_id
    )
  );

DROP POLICY IF EXISTS "Members: self insert" ON public.organization_members;
CREATE POLICY "Members: self bootstrap first"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_members existing
      WHERE existing.organization_id = organization_members.organization_id
    )
  );

-- ============================================================
-- SECURITY DEFINER functions: restrict EXECUTE
-- Triggers run as table owner regardless of grants, so revoking from PUBLIC is safe.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated;
