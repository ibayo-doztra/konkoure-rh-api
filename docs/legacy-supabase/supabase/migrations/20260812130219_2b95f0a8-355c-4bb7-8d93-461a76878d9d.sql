CREATE POLICY "previews: self or manager insert"
ON public.performance_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = performance_reviews.employee_id
      AND e.organization_id = performance_reviews.organization_id
      AND e.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.employees m
    WHERE m.id = performance_reviews.manager_id
      AND m.organization_id = performance_reviews.organization_id
      AND m.user_id = auth.uid()
  )
);