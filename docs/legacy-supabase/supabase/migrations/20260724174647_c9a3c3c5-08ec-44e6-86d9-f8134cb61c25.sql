CREATE OR REPLACE FUNCTION private.is_employee_manager(_user uuid, _employee uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.departments d ON d.id = e.department_id
    JOIN public.employees m ON m.id = d.manager_id
    WHERE e.id = _employee
      AND m.user_id = _user
      AND m.user_id IS DISTINCT FROM e.user_id
  )
$function$;