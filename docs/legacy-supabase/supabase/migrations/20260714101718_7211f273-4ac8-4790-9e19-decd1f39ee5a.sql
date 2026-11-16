
-- Lock down SECURITY DEFINER functions: revoke EXECUTE from anon/authenticated/public
-- These functions are only invoked by triggers or by server code using the service role.

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.employees_badge_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_social_account_token(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_assign_employee_badge(uuid, text, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_revoke_employee_badge(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Ensure service_role retains access (used by supabaseAdmin and trigger execution runs as table owner).
GRANT EXECUTE ON FUNCTION public.get_social_account_token(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_assign_employee_badge(uuid, text, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_employee_badge(uuid, uuid) TO service_role;
