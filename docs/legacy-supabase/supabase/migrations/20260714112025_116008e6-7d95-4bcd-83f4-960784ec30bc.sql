
-- 1) AVATARS: replace overly broad public read with a policy that excludes sensitive employee paths
DROP POLICY IF EXISTS "Avatars: public read" ON storage.objects;

CREATE POLICY "Avatars: public read non-sensitive"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) <> 'employees'
);

-- 2) CANDIDATE_ACTIVITIES: only allow team members to insert 'note_added' entries
DROP POLICY IF EXISTS "candidate_activities: members insert" ON public.candidate_activities;

CREATE POLICY "candidate_activities: members insert notes"
ON public.candidate_activities
FOR INSERT
TO authenticated
WITH CHECK (
  private.is_org_member(auth.uid(), organization_id)
  AND actor_id = auth.uid()
  AND type = 'note_added'::candidate_activity_type
  AND EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_activities.candidate_id
      AND c.organization_id = candidate_activities.organization_id
  )
);

-- 3) SOCIAL_ACCOUNTS: hide OAuth metadata column from client roles
REVOKE SELECT (metadata) ON public.social_accounts FROM anon, authenticated;
