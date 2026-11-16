
REVOKE INSERT, SELECT, UPDATE, DELETE ON public.candidate_activities FROM anon;

REVOKE SELECT ON public.social_accounts FROM authenticated;
GRANT SELECT (
  id, organization_id, provider, account_id, account_name,
  token_expires_at, scopes, status, connected_by, connected_at, metadata
) ON public.social_accounts TO authenticated;
REVOKE SELECT ON public.social_accounts FROM anon;
