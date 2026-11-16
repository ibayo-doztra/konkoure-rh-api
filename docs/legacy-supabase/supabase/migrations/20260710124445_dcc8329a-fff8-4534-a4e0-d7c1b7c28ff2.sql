
-- =========================================================
-- 1) Move social OAuth tokens out of the Data-API-exposed
--    public.social_accounts table into a private-schema table
--    that PostgREST cannot reach at all.
-- =========================================================

CREATE TABLE IF NOT EXISTS private.social_account_tokens (
  account_id uuid PRIMARY KEY REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON private.social_account_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.social_account_tokens TO service_role;

ALTER TABLE private.social_account_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (which bypasses RLS) can access.

-- Backfill existing tokens
INSERT INTO private.social_account_tokens (account_id, access_token, refresh_token)
SELECT id, access_token, COALESCE(refresh_token, NULL)
FROM public.social_accounts
WHERE access_token IS NOT NULL
ON CONFLICT (account_id) DO NOTHING;

-- Drop the token columns from the public table so admins querying it
-- directly can no longer read live OAuth tokens.
ALTER TABLE public.social_accounts DROP COLUMN IF EXISTS access_token;
ALTER TABLE public.social_accounts DROP COLUMN IF EXISTS refresh_token;

-- =========================================================
-- 2) Tighten candidate_activities INSERT policy
--    - Require actor_id = auth.uid() for authenticated inserts
--      (prevents members from forging activity records with a
--       spoofed / NULL actor via direct PostgREST calls)
--    - Anonymous inserts remain revoked at GRANT level; the
--      server-side webhook uses service_role which bypasses RLS.
-- =========================================================

DROP POLICY IF EXISTS "candidate_activities: members insert" ON public.candidate_activities;
CREATE POLICY "candidate_activities: members insert"
  ON public.candidate_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    private.is_org_member(auth.uid(), organization_id)
    AND actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.id = candidate_activities.candidate_id
        AND c.organization_id = candidate_activities.organization_id
    )
  );
