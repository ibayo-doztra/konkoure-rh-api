-- Add logo column to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url text;

-- Create public bucket for org logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for logos
CREATE POLICY "org-logos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'org-logos');

-- Members of an org can upload/update/delete logos in their org folder (path = "{organization_id}/...")
CREATE POLICY "org-logos members insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'org-logos'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "org-logos members update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'org-logos'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "org-logos members delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'org-logos'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);