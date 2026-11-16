
-- Employees: column-level INSERT/UPDATE to preserve sensitive column protection
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

-- Other tables: full DML
GRANT INSERT, UPDATE, DELETE ON public.departments       TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.contracts         TO authenticated;
GRANT UPDATE, DELETE          ON public.notifications    TO authenticated;
GRANT UPDATE                  ON public.candidates       TO authenticated;
GRANT INSERT, DELETE          ON public.candidate_notes  TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.skills            TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.employee_skills   TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.work_zones        TO authenticated;
