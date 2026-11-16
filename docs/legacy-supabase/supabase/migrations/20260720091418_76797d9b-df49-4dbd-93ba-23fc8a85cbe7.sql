-- Revoke EXECUTE from PUBLIC/anon/authenticated on SECURITY DEFINER admin & trigger functions
REVOKE EXECUTE ON FUNCTION public.admin_assign_employee_badge(uuid, text, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_employee_badge(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_social_account_token(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.employees_badge_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;