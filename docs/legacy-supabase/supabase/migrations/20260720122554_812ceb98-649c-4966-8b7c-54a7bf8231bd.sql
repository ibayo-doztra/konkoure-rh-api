
GRANT SELECT (
  id, organization_id, user_id,
  first_name, last_name, email, phone, photo_url,
  job_title, department_id, manager_id,
  hire_date, status, position,
  created_at, updated_at
) ON public.employees TO authenticated;

GRANT UPDATE (
  first_name, last_name, email, phone, photo_url,
  job_title, department_id, manager_id,
  hire_date, status, position
) ON public.employees TO authenticated;

GRANT SELECT ON public.social_accounts TO authenticated;

GRANT ALL ON public.employees TO service_role;
GRANT ALL ON public.social_accounts TO service_role;
