
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS deadline timestamptz,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS required_documents jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_org_slug_unique ON public.jobs(organization_id, slug) WHERE slug IS NOT NULL;

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS cover_letter_url text,
  ADD COLUMN IF NOT EXISTS documents jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO storage.buckets (id, name, public)
VALUES ('applications', 'applications', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Applications: public read" ON storage.objects;
DROP POLICY IF EXISTS "Applications: public upload" ON storage.objects;
DROP POLICY IF EXISTS "Applications: members delete" ON storage.objects;

CREATE POLICY "Applications: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'applications');

CREATE POLICY "Applications: public upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'applications');

CREATE POLICY "Applications: members delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'applications'
  AND is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
