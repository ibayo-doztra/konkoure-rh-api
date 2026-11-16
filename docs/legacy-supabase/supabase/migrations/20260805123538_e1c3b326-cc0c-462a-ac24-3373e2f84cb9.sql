CREATE OR REPLACE FUNCTION private.is_in_my_subtree(_user uuid, _employee uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH RECURSIVE me AS (
    SELECT e.id FROM public.employees e WHERE e.user_id = _user
  ), subtree AS (
    SELECT e.id
      FROM public.employees e
     WHERE e.manager_id IN (SELECT id FROM me)
        OR e.department_id IN (
             SELECT d.id FROM public.departments d WHERE d.manager_id IN (SELECT id FROM me)
           )
    UNION
    SELECT c.id
      FROM public.employees c
      JOIN subtree s ON c.manager_id = s.id
  )
  SELECT EXISTS (SELECT 1 FROM subtree WHERE id = _employee)
     AND NOT EXISTS (SELECT 1 FROM me WHERE id = _employee AND _employee IS NULL);
$function$;

REVOKE ALL ON FUNCTION private.is_in_my_subtree(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_in_my_subtree(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "employees: members read" ON public.employees;

CREATE POLICY "employees: scoped read"
ON public.employees
FOR SELECT
TO authenticated
USING (
  private.is_org_member(auth.uid(), organization_id)
  AND (
    private.is_org_admin(auth.uid(), organization_id)
    OR user_id = auth.uid()
    OR private.is_in_my_subtree(auth.uid(), id)
  )
);