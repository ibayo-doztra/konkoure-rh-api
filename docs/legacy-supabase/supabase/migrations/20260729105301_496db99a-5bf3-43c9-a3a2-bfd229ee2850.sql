REVOKE ALL ON FUNCTION public.list_public_organization_slugs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_organization_slugs() TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_organization(p_slug text)
 RETURNS TABLE(id uuid, name text, slug text, logo_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.id, o.name, o.slug, o.logo_url
  FROM public.organizations o
  WHERE o.slug = p_slug
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.organization_id = o.id AND j.status = 'published'
    )
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_public_organization(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_organization(text) TO anon, authenticated, service_role;