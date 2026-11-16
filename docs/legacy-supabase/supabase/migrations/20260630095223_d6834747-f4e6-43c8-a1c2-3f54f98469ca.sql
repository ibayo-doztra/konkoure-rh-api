
-- 1. Restrict token columns on social_accounts to service_role only
REVOKE ALL ON public.social_accounts FROM authenticated, anon;
GRANT SELECT (id, organization_id, provider, account_id, account_name, scopes, status, connected_by, connected_at, token_expires_at, metadata) ON public.social_accounts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;

-- Restrict UPDATE/INSERT of tokens to admins only (members should not write tokens)
DROP POLICY IF EXISTS "social_accounts: members update" ON public.social_accounts;
DROP POLICY IF EXISTS "social_accounts: members write" ON public.social_accounts;
CREATE POLICY "social_accounts: admins update" ON public.social_accounts
  FOR UPDATE USING (is_org_admin(auth.uid(), organization_id))
  WITH CHECK (is_org_admin(auth.uid(), organization_id));
CREATE POLICY "social_accounts: admins insert" ON public.social_accounts
  FOR INSERT WITH CHECK (is_org_admin(auth.uid(), organization_id));

-- 2. Restrict anonymous candidate_activities inserts to safe public event types
DROP POLICY IF EXISTS "candidate_activities: anon insert" ON public.candidate_activities;
CREATE POLICY "candidate_activities: anon insert" ON public.candidate_activities
  FOR INSERT TO anon
  WITH CHECK (
    actor_id IS NULL
    AND candidate_id IS NOT NULL
    AND type = 'created'::candidate_activity_type
    AND EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = candidate_activities.candidate_id
        AND c.organization_id = candidate_activities.organization_id
    )
  );

-- 3. Avatars bucket: add storage.objects SELECT policy so signed/authenticated reads still work
-- (bucket was just flipped to private; public URLs no longer resolve)
DROP POLICY IF EXISTS "Avatars: public read" ON storage.objects;
CREATE POLICY "Avatars: public read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

-- 4. SECURITY DEFINER helpers: prevent enumeration of other users' membership
-- Callers can only check their own auth.uid().
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _user_id <> auth.uid() THEN false
         ELSE EXISTS (SELECT 1 FROM public.organization_members
                       WHERE user_id = _user_id AND organization_id = _org_id)
         END
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _user_id <> auth.uid() THEN false
         ELSE EXISTS (SELECT 1 FROM public.user_roles
                       WHERE user_id = _user_id AND organization_id = _org_id
                         AND role IN ('owner','hr_admin'))
         END
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _org_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _user_id <> auth.uid() THEN false
         ELSE EXISTS (SELECT 1 FROM public.user_roles
                       WHERE user_id = _user_id AND organization_id = _org_id AND role = _role)
         END
$$;
