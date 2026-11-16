GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated, anon;