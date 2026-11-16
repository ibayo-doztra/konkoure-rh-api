DROP POLICY IF EXISTS "candidate_activities: members insert notes" ON public.candidate_activities;
CREATE POLICY "candidate_activities: recruitment insert notes"
ON public.candidate_activities
FOR INSERT
TO authenticated
WITH CHECK (
  private.is_recruitment_staff(auth.uid(), organization_id)
  AND actor_id = auth.uid()
  AND type = ANY (ARRAY['note_added'::candidate_activity_type, 'note_deleted'::candidate_activity_type])
  AND EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_activities.candidate_id
      AND c.organization_id = candidate_activities.organization_id
  )
);

DROP POLICY IF EXISTS "candidate_notes: author or admin delete" ON public.candidate_notes;
CREATE POLICY "candidate_notes: author or admin delete"
ON public.candidate_notes
FOR DELETE
TO authenticated
USING (
  private.is_org_member(auth.uid(), organization_id)
  AND (
    (auth.uid() = author_id AND private.is_recruitment_staff(auth.uid(), organization_id))
    OR private.is_org_admin(auth.uid(), organization_id)
  )
);