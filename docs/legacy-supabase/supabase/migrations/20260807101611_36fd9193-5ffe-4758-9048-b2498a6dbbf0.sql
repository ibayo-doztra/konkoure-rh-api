ALTER TABLE public.demo_requests
  ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_error text;

ALTER TABLE public.demo_requests
  DROP CONSTRAINT IF EXISTS demo_requests_email_status_check;

ALTER TABLE public.demo_requests
  ADD CONSTRAINT demo_requests_email_status_check
  CHECK (email_status IN ('pending','sent','failed'));