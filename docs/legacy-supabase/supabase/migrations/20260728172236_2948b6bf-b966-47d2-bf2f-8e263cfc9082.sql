
CREATE OR REPLACE FUNCTION public.verify_cron_token(p_name text, p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.cron_tokens c
     WHERE c.name = p_name AND c.token = p_token
  );
$$;

REVOKE ALL ON FUNCTION public.verify_cron_token(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_token(text, text) TO service_role;
