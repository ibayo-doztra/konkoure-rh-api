
-- Revoke EXECUTE from anon/authenticated/PUBLIC on internal SECURITY DEFINER
-- functions that must not be reachable from PostgREST.
REVOKE EXECUTE ON FUNCTION public.accrue_monthly_leave() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_fixed_holidays_for_org(uuid, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.compute_working_days(uuid, date, date) FROM anon, PUBLIC;

-- Trigger functions should never be callable via PostgREST.
REVOKE EXECUTE ON FUNCTION public.leave_requests_after_insert_balance() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.leave_requests_before_delete_balance() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.leave_requests_guard_status() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.organizations_seed_holidays() FROM anon, authenticated, PUBLIC;
