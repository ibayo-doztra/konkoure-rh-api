
CREATE OR REPLACE FUNCTION public.get_employee_leave_balance(p_employee uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user uuid;
  v_balance numeric;
BEGIN
  SELECT e.organization_id, e.user_id, e.leave_balance
    INTO v_org, v_user, v_balance
  FROM public.employees e WHERE e.id = p_employee;

  IF v_org IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT (private.is_org_admin(auth.uid(), v_org)
          OR private.is_employee_manager(auth.uid(), p_employee)
          OR v_user = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.get_employee_leave_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_leave_balance(uuid) TO authenticated, service_role;
