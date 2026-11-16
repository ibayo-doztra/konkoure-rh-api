DROP VIEW IF EXISTS public.organizations_public;

CREATE OR REPLACE FUNCTION public.get_public_organization(p_slug text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.id, o.name, o.slug, o.logo_url
  FROM public.organizations o
  WHERE o.slug = p_slug
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.list_public_organization_slugs()
RETURNS TABLE(slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.slug FROM public.organizations o WHERE o.slug IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_public_organization(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_public_organization_slugs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_organization(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_public_organization_slugs() TO anon, authenticated, service_role;