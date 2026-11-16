CREATE OR REPLACE FUNCTION private.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.organization_members
      WHERE user_id = _user_id
        AND organization_id = _org_id
    )
  END
$$;

CREATE OR REPLACE FUNCTION private.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND organization_id = _org_id
        AND role IN ('owner', 'hr_admin')
    )
  END
$$;

REVOKE ALL ON FUNCTION private.is_org_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_org_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_org_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_org_admin(uuid, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Applications: anon upload constrained" ON storage.objects;
CREATE POLICY "Applications: anon upload constrained"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'applications'
  AND array_length(storage.foldername(name), 1) >= 3
  AND length(name) < 512
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.organization_id = ((storage.foldername(objects.name))[1])::uuid
      AND j.id = ((storage.foldername(objects.name))[2])::uuid
      AND j.status = 'published'
  )
);