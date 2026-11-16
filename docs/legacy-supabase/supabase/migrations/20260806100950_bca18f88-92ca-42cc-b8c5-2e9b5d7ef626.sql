ALTER TABLE public.subscription_payments
  ALTER COLUMN org_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS claim_email text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_claim_token_key
  ON public.subscription_payments (claim_token)
  WHERE claim_token IS NOT NULL;

ALTER TABLE public.subscription_payments
  DROP CONSTRAINT IF EXISTS subscription_payments_owner_check;

ALTER TABLE public.subscription_payments
  ADD CONSTRAINT subscription_payments_owner_check
  CHECK (org_id IS NOT NULL OR (claim_email IS NOT NULL AND claim_token IS NOT NULL));