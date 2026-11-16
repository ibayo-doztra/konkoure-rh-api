
REVOKE ALL ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_org_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;
