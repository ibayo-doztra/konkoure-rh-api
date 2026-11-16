REVOKE ALL ON FUNCTION public.get_public_organization(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_organization(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_public_organization(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_organization(text) TO service_role;