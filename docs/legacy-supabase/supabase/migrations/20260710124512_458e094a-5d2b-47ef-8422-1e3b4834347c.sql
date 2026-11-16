
CREATE OR REPLACE FUNCTION public.get_social_account_token(_account_id uuid)
RETURNS TABLE(access_token text, refresh_token text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT access_token, refresh_token
  FROM private.social_account_tokens
  WHERE account_id = _account_id
$$;

REVOKE ALL ON FUNCTION public.get_social_account_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_social_account_token(uuid) TO service_role;
