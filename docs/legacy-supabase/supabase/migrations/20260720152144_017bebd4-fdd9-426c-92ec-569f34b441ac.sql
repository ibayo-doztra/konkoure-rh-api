GRANT SELECT (
  id, organization_id, user_id,
  first_name, last_name, email, phone, photo_url,
  job_title, department_id, manager_id,
  hire_date, status, created_at, position, updated_at
) ON public.employees TO authenticated;

GRANT INSERT (
  organization_id, user_id,
  first_name, last_name, email, phone, photo_url,
  job_title, department_id, manager_id,
  hire_date, status, position
) ON public.employees TO authenticated;

GRANT UPDATE (
  first_name, last_name, email, phone, photo_url,
  job_title, department_id, manager_id,
  hire_date, status, position
) ON public.employees TO authenticated;

GRANT DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;