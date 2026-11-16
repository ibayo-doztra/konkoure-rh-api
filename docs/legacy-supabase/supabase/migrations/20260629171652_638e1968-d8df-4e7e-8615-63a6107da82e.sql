
-- 1. social_accounts: restrict SELECT to admins (tokens protection)
DROP POLICY IF EXISTS "social_accounts: members read" ON public.social_accounts;
CREATE POLICY "social_accounts: admins read"
  ON public.social_accounts FOR SELECT
  USING (public.is_org_admin(auth.uid(), organization_id));

-- 2. employees: prevent non-admin user_id changes
DROP POLICY IF EXISTS "employees: members update" ON public.employees;
CREATE POLICY "employees: members update"
  ON public.employees FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (
    public.is_org_member(auth.uid(), organization_id)
    AND (
      public.is_org_admin(auth.uid(), organization_id)
      OR user_id IS NOT DISTINCT FROM (
        SELECT e.user_id FROM public.employees e WHERE e.id = employees.id
      )
    )
  );

-- 3. candidate_activities: tight anon insert
CREATE POLICY "candidate_activities: anon insert"
  ON public.candidate_activities FOR INSERT
  TO anon
  WITH CHECK (
    actor_id IS NULL
    AND candidate_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = candidate_activities.candidate_id
        AND c.organization_id = candidate_activities.organization_id
    )
  );

-- 4. storage cvs & employee-docs delete policies (admins only)
CREATE POLICY "CVs: admins delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cvs'
    AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Docs: admins delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'employee-docs'
    AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- 5. avatars: remove broad listing; keep public CDN reads (which don't need a policy on public buckets)
DROP POLICY IF EXISTS "Avatars: public read" ON storage.objects;
CREATE POLICY "Avatars: owner list"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- 6. Revoke anon EXECUTE on SECURITY DEFINER RLS helpers
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, app_role) FROM anon;
