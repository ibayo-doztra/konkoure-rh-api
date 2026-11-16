-- Allow secure read access to legacy passport scans that were previously uploaded
-- in the avatars bucket as <uploader_user_id>/employees/<employee_id>/passport-...
-- New passport uploads continue to use employee-docs only.

DROP POLICY IF EXISTS "Avatars: legacy passport admins read" ON storage.objects;
DROP POLICY IF EXISTS "Avatars: legacy passport employee read own" ON storage.objects;

CREATE POLICY "Avatars: legacy passport admins read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 2) = 'employees'
  AND split_part(name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 4) LIKE 'passport-%'
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.user_roles ur
      ON ur.organization_id = e.organization_id
     AND ur.user_id = auth.uid()
     AND ur.role IN ('owner','hr_admin')
    WHERE e.id = split_part(name, '/', 3)::uuid
  )
);

CREATE POLICY "Avatars: legacy passport employee read own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 2) = 'employees'
  AND split_part(name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 4) LIKE 'passport-%'
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = split_part(name, '/', 3)::uuid
      AND e.user_id = auth.uid()
  )
);