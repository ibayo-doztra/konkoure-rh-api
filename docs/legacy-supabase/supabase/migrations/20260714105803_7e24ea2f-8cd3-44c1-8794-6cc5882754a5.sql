-- Harden employee-docs storage access for passport scans and avoid legacy path casts
-- breaking employees/<employee_id>/... paths.

DROP POLICY IF EXISTS "Docs: auth read" ON storage.objects;
DROP POLICY IF EXISTS "Docs: auth write" ON storage.objects;
DROP POLICY IF EXISTS "Docs: members read" ON storage.objects;
DROP POLICY IF EXISTS "Docs: members write" ON storage.objects;
DROP POLICY IF EXISTS "Docs: admins update" ON storage.objects;

DROP POLICY IF EXISTS "employee_docs_admins_select" ON storage.objects;
DROP POLICY IF EXISTS "employee_docs_self_select" ON storage.objects;
DROP POLICY IF EXISTS "employee_docs_admins_insert" ON storage.objects;
DROP POLICY IF EXISTS "employee_docs_admins_update" ON storage.objects;
DROP POLICY IF EXISTS "employee_docs_admins_delete" ON storage.objects;

DROP POLICY IF EXISTS "Docs: org members read legacy org paths" ON storage.objects;
DROP POLICY IF EXISTS "Docs: org members insert legacy org paths" ON storage.objects;
DROP POLICY IF EXISTS "Docs: org admins update legacy org paths" ON storage.objects;
DROP POLICY IF EXISTS "Docs: passport admins read" ON storage.objects;
DROP POLICY IF EXISTS "Docs: passport employee read own" ON storage.objects;
DROP POLICY IF EXISTS "Docs: passport admins insert" ON storage.objects;
DROP POLICY IF EXISTS "Docs: passport admins update" ON storage.objects;
DROP POLICY IF EXISTS "Docs: passport admins delete" ON storage.objects;

-- Legacy employee-docs paths that start with an organization UUID remain readable
-- by organization members. The UUID regex prevents invalid casts for paths like
-- employees/<employee_id>/passport.pdf.
CREATE POLICY "Docs: org members read legacy org paths"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = split_part(name, '/', 1)::uuid
  )
);

CREATE POLICY "Docs: org members insert legacy org paths"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = split_part(name, '/', 1)::uuid
  )
);

CREATE POLICY "Docs: org admins update legacy org paths"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = split_part(name, '/', 1)::uuid
      AND ur.role IN ('owner','hr_admin')
  )
)
WITH CHECK (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = split_part(name, '/', 1)::uuid
      AND ur.role IN ('owner','hr_admin')
  )
);

-- Passport scan paths: employees/<employee_id>/...
CREATE POLICY "Docs: passport admins read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) = 'employees'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.user_roles ur
      ON ur.organization_id = e.organization_id
     AND ur.user_id = auth.uid()
     AND ur.role IN ('owner','hr_admin')
    WHERE e.id = split_part(name, '/', 2)::uuid
  )
);

CREATE POLICY "Docs: passport employee read own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) = 'employees'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = split_part(name, '/', 2)::uuid
      AND e.user_id = auth.uid()
  )
);

CREATE POLICY "Docs: passport admins insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) = 'employees'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.user_roles ur
      ON ur.organization_id = e.organization_id
     AND ur.user_id = auth.uid()
     AND ur.role IN ('owner','hr_admin')
    WHERE e.id = split_part(name, '/', 2)::uuid
  )
);

CREATE POLICY "Docs: passport admins update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) = 'employees'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.user_roles ur
      ON ur.organization_id = e.organization_id
     AND ur.user_id = auth.uid()
     AND ur.role IN ('owner','hr_admin')
    WHERE e.id = split_part(name, '/', 2)::uuid
  )
)
WITH CHECK (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) = 'employees'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.user_roles ur
      ON ur.organization_id = e.organization_id
     AND ur.user_id = auth.uid()
     AND ur.role IN ('owner','hr_admin')
    WHERE e.id = split_part(name, '/', 2)::uuid
  )
);

CREATE POLICY "Docs: passport admins delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-docs'
  AND split_part(name, '/', 1) = 'employees'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.user_roles ur
      ON ur.organization_id = e.organization_id
     AND ur.user_id = auth.uid()
     AND ur.role IN ('owner','hr_admin')
    WHERE e.id = split_part(name, '/', 2)::uuid
  )
);