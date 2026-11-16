
DROP POLICY IF EXISTS "Candidates: public apply" ON public.candidates;
CREATE POLICY "Candidates: public apply"
ON public.candidates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = candidates.job_id
      AND j.organization_id = candidates.organization_id
      AND j.status = 'published'
  )
);

DROP POLICY IF EXISTS "candidate_activities: members insert" ON public.candidate_activities;
CREATE POLICY "candidate_activities: members insert"
ON public.candidate_activities FOR INSERT
WITH CHECK (is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Org admins manage webhook config" ON public.recruitment_webhook_configs;
CREATE POLICY "Org admins manage webhook config"
ON public.recruitment_webhook_configs FOR ALL
TO authenticated
USING (is_org_admin(auth.uid(), organization_id))
WITH CHECK (is_org_admin(auth.uid(), organization_id));

REVOKE SELECT ON public.social_accounts FROM authenticated, anon;
GRANT SELECT
  (id, organization_id, provider, account_id, account_name, status,
   token_expires_at, scopes, connected_by, connected_at, metadata)
ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.handle_new_user()',
    'public.set_updated_at()',
    'public.goals_require_owner()',
    'public.goal_activities_require_employee()',
    'public.achievements_require_employee()',
    'public.okrs_require_employee()',
    'public.reviews_require_plan_or_cycle()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Applications: anon upload constrained" ON storage.objects;
CREATE POLICY "Applications: anon upload constrained"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'applications'
  AND array_length(storage.foldername(name), 1) >= 3
  AND length(name) < 512
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.organization_id = ((storage.foldername(name))[1])::uuid
      AND j.id = ((storage.foldername(name))[2])::uuid
      AND j.status = 'published'
  )
);
