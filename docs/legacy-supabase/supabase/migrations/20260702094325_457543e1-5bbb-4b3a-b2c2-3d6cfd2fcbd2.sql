
-- Remove the three broken social-media storage policies that only checked
-- "member of any org" without matching the file's org folder. The correctly
-- scoped "Org members can ..." policies remain.
DROP POLICY IF EXISTS "social-media: members insert" ON storage.objects;
DROP POLICY IF EXISTS "social-media: members update" ON storage.objects;
DROP POLICY IF EXISTS "social-media: members delete" ON storage.objects;

-- Add explicit UPDATE governance to cvs and employee-docs buckets so file
-- overwrites are restricted to org admins.
CREATE POLICY "CVs: admins update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'cvs' AND private.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'cvs' AND private.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Docs: admins update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'employee-docs' AND private.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'employee-docs' AND private.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid));
