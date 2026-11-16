ALTER TABLE public.demo_requests ALTER COLUMN phone SET NOT NULL;
ALTER TABLE public.demo_requests ALTER COLUMN message DROP NOT NULL;

DROP POLICY IF EXISTS "Anyone can submit a demo request" ON public.demo_requests;

CREATE POLICY "Anyone can submit a demo request"
  ON public.demo_requests FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(full_name) BETWEEN 1 AND 120
    AND length(email) BETWEEN 3 AND 255
    AND length(phone) BETWEEN 1 AND 40
    AND length(company_name) BETWEEN 1 AND 160
    AND company_size IN ('1-10','11-50','51-200','201-500','500+')
    AND (message IS NULL OR length(message) <= 2000)
    AND status = 'new'
  );