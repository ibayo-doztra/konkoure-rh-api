
-- Storage policies for employee-docs bucket, scoped to employees/<employee_id>/... paths
DROP POLICY IF EXISTS "employee_docs_admins_select" ON storage.objects;
DROP POLICY IF EXISTS "employee_docs_self_select" ON storage.objects;
DROP POLICY IF EXISTS "employee_docs_admins_insert" ON storage.objects;
DROP POLICY IF EXISTS "employee_docs_admins_update" ON storage.objects;
DROP POLICY IF EXISTS "employee_docs_admins_delete" ON storage.objects;

CREATE POLICY "employee_docs_admins_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) = 'employees'
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.user_roles ur
      ON ur.organization_id = e.organization_id
     AND ur.user_id = auth.uid()
     AND ur.role IN ('owner','hr_admin')
    WHERE e.id::text = split_part(name, '/', 2)
  )
);

CREATE POLICY "employee_docs_self_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) = 'employees'
  AND EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id::text = split_part(name, '/', 2)
      AND e.user_id = auth.uid()
  )
);

CREATE POLICY "employee_docs_admins_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) = 'employees'
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.user_roles ur
      ON ur.organization_id = e.organization_id
     AND ur.user_id = auth.uid()
     AND ur.role IN ('owner','hr_admin')
    WHERE e.id::text = split_part(name, '/', 2)
  )
);

CREATE POLICY "employee_docs_admins_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) = 'employees'
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.user_roles ur
      ON ur.organization_id = e.organization_id
     AND ur.user_id = auth.uid()
     AND ur.role IN ('owner','hr_admin')
    WHERE e.id::text = split_part(name, '/', 2)
  )
)
WITH CHECK (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) = 'employees'
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.user_roles ur
      ON ur.organization_id = e.organization_id
     AND ur.user_id = auth.uid()
     AND ur.role IN ('owner','hr_admin')
    WHERE e.id::text = split_part(name, '/', 2)
  )
);

CREATE POLICY "employee_docs_admins_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) = 'employees'
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.user_roles ur
      ON ur.organization_id = e.organization_id
     AND ur.user_id = auth.uid()
     AND ur.role IN ('owner','hr_admin')
    WHERE e.id::text = split_part(name, '/', 2)
  )
);
