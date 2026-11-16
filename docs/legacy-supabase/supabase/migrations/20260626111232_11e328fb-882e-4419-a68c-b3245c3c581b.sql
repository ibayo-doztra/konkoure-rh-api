
-- 1) recruitment_webhook_configs: restrict SELECT to org admins (URLs are sensitive)
DROP POLICY IF EXISTS "Org members can read webhook config" ON public.recruitment_webhook_configs;
CREATE POLICY "Org admins read webhook config"
ON public.recruitment_webhook_configs
FOR SELECT TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id));

-- 2) social_accounts: column-level security to hide OAuth tokens & metadata from members
REVOKE SELECT ON public.social_accounts FROM authenticated, anon;
GRANT SELECT (id, organization_id, provider, account_id, account_name, status, connected_by, connected_at, scopes, token_expires_at)
  ON public.social_accounts TO authenticated;
-- service_role keeps full access (already granted via GRANT ALL elsewhere; ensure it)
GRANT ALL ON public.social_accounts TO service_role;

-- 3) notifications: tighten INSERT so members cannot spam other users
DROP POLICY IF EXISTS "notif: members insert" ON public.notifications;
CREATE POLICY "notif: self or admin insert"
ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_admin(auth.uid(), organization_id)
  OR auth.uid() = user_id
);

-- 4) Storage avatars bucket: require first path segment = auth.uid()
DROP POLICY IF EXISTS "Avatars: auth upload" ON storage.objects;
CREATE POLICY "Avatars: user uploads to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);
