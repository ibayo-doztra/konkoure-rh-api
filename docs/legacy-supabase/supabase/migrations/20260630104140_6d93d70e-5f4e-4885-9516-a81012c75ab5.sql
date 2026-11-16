
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION private.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _user_id <> auth.uid() THEN false
         ELSE EXISTS (SELECT 1 FROM public.organization_members
                       WHERE user_id = _user_id AND organization_id = _org_id)
         END
$$;

CREATE OR REPLACE FUNCTION private.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _user_id <> auth.uid() THEN false
         ELSE EXISTS (SELECT 1 FROM public.user_roles
                       WHERE user_id = _user_id AND organization_id = _org_id
                         AND role IN ('owner','hr_admin'))
         END
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _org_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _user_id <> auth.uid() THEN false
         ELSE EXISTS (SELECT 1 FROM public.user_roles
                       WHERE user_id = _user_id AND organization_id = _org_id AND role = _role)
         END
$$;

REVOKE ALL ON FUNCTION private.is_org_member(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_org_admin(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_role(uuid,uuid,public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_org_member(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_org_admin(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid,uuid,public.app_role) TO authenticated;

DO $mig$
DECLARE
  r record;
  v_using text;
  v_check text;
  v_cmd text;
  v_roles text;
BEGIN
  FOR r IN
    SELECT p.schemaname, p.tablename, p.policyname, p.permissive,
           p.roles AS pol_roles, p.cmd AS pol_cmd,
           p.qual AS pol_qual, p.with_check AS pol_check
    FROM pg_policies p
    WHERE (p.qual ~ '\m(is_org_member|is_org_admin|has_role)\M'
        OR p.with_check ~ '\m(is_org_member|is_org_admin|has_role)\M')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    v_using := regexp_replace(coalesce(r.pol_qual, ''),
                 '\m(is_org_member|is_org_admin|has_role)\M', 'private.\1', 'g');
    v_check := regexp_replace(coalesce(r.pol_check, ''),
                 '\m(is_org_member|is_org_admin|has_role)\M', 'private.\1', 'g');
    v_roles := array_to_string(r.pol_roles, ', ');
    v_cmd := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
                    r.policyname, r.schemaname, r.tablename,
                    r.permissive, r.pol_cmd, v_roles);
    IF r.pol_qual IS NOT NULL THEN
      v_cmd := v_cmd || format(' USING (%s)', v_using);
    END IF;
    IF r.pol_check IS NOT NULL THEN
      v_cmd := v_cmd || format(' WITH CHECK (%s)', v_check);
    END IF;
    EXECUTE v_cmd;
  END LOOP;
END
$mig$;

DROP FUNCTION IF EXISTS public.is_org_member(uuid,uuid);
DROP FUNCTION IF EXISTS public.is_org_admin(uuid,uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid,uuid,public.app_role);

REVOKE SELECT ON public.social_accounts FROM authenticated;
GRANT SELECT
  (id, organization_id, provider, account_id, account_name,
   token_expires_at, scopes, status, connected_by, connected_at)
  ON public.social_accounts TO authenticated;

DROP POLICY IF EXISTS "candidate_activities: anon insert" ON public.candidate_activities;

DROP POLICY IF EXISTS "social-media: public read" ON storage.objects;
CREATE POLICY "social-media: public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'social-media');

DROP POLICY IF EXISTS "social-media: members insert" ON storage.objects;
CREATE POLICY "social-media: members insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'social-media'
    AND EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "social-media: members update" ON storage.objects;
CREATE POLICY "social-media: members update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'social-media'
    AND EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = auth.uid()))
  WITH CHECK (bucket_id = 'social-media'
    AND EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = auth.uid()));

DROP POLICY IF EXISTS "social-media: members delete" ON storage.objects;
CREATE POLICY "social-media: members delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'social-media'
    AND EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = auth.uid()));
