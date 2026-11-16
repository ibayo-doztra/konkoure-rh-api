DROP POLICY IF EXISTS plans_read_authenticated ON public.plans;
CREATE POLICY plans_read_own_org ON public.plans FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.organizations o
  JOIN public.user_roles ur ON ur.organization_id = o.id AND ur.user_id = auth.uid()
  WHERE o.plan_id = plans.id
));

DROP POLICY IF EXISTS "Avatars: public read non-sensitive" ON storage.objects;
CREATE POLICY "Avatars: org members read non-sensitive" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) <> 'employees'
  AND (
    split_part(name, '/', 1) = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.user_roles me
      JOIN public.user_roles up ON up.organization_id = me.organization_id
      WHERE me.user_id = auth.uid()
        AND up.user_id::text = split_part(objects.name, '/', 1)
    )
  )
);