CREATE TABLE public.demo_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company_name text NOT NULL,
  company_size text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.demo_requests TO anon;
GRANT INSERT ON public.demo_requests TO authenticated;
GRANT ALL ON public.demo_requests TO service_role;

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a demo request"
  ON public.demo_requests FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(full_name) BETWEEN 1 AND 120
    AND length(email) BETWEEN 3 AND 255
    AND length(company_name) BETWEEN 1 AND 160
    AND company_size IN ('1-10','11-50','51-200','201-500','500+')
    AND length(message) BETWEEN 1 AND 2000
    AND (phone IS NULL OR length(phone) <= 40)
    AND status = 'new'
  );

CREATE TRIGGER demo_requests_set_updated_at
  BEFORE UPDATE ON public.demo_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();