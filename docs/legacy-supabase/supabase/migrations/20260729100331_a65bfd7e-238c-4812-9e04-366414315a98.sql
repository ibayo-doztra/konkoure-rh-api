-- 1) employees: remove all anonymous access (sensitive columns included)
REVOKE ALL ON public.employees FROM anon;

-- 2) webhook_events: server-only technical table
REVOKE ALL ON public.webhook_events FROM anon;
REVOKE ALL ON public.webhook_events FROM authenticated;
GRANT ALL ON public.webhook_events TO service_role;