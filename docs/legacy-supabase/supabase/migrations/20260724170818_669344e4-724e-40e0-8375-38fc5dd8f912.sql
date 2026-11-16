
-- 1) Restrict departments UPDATE: admins only, and add trigger enforcing manager_id changes require admin
DROP POLICY IF EXISTS "departments: members update" ON public.departments;

CREATE POLICY "departments: admins update"
ON public.departments
FOR UPDATE
USING (private.is_org_admin(auth.uid(), organization_id))
WITH CHECK (private.is_org_admin(auth.uid(), organization_id));

-- 2) Guard trigger on employees: non-admin cannot change department_id/manager_id on own row
CREATE OR REPLACE FUNCTION public.employees_guard_org_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;
  IF private.is_org_admin(v_uid, NEW.organization_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.department_id IS DISTINCT FROM OLD.department_id
     OR NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
    RAISE EXCEPTION 'Seul un administrateur peut modifier le département ou le manager d''un employé'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employees_guard_org_assignment ON public.employees;
CREATE TRIGGER trg_employees_guard_org_assignment
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.employees_guard_org_assignment();

-- 3) Revoke authenticated EXECUTE on internal RPCs (called via server functions using service role)
REVOKE EXECUTE ON FUNCTION public.compute_working_days(uuid, date, date) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_employee_leave_balance(uuid) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_leave_request_status(uuid, text, uuid) FROM authenticated, PUBLIC;
