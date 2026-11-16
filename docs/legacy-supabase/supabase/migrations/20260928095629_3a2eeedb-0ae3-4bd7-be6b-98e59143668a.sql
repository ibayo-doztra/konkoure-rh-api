CREATE TABLE public.prepaid_email_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.prepaid_email_codes TO service_role;
REVOKE ALL ON public.prepaid_email_codes FROM anon, authenticated;
ALTER TABLE public.prepaid_email_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX prepaid_email_codes_email_idx ON public.prepaid_email_codes (email, created_at DESC);