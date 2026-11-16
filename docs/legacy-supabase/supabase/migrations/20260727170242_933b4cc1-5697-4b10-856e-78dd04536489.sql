CREATE OR REPLACE FUNCTION public.get_employee_leave_balance(p_employee uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_user uuid;
  v_balance numeric;
  v_uid uuid := COALESCE(auth.uid(), p_actor);
BEGIN
  SELECT e.organization_id, e.user_id, e.leave_balance
    INTO v_org, v_user, v_balance
  FROM public.employees e WHERE e.id = p_employee;

  IF v_org IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_uid IS NULL OR NOT (private.is_org_admin(v_uid, v_org)
          OR private.is_employee_manager(v_uid, p_employee)
          OR v_user = v_uid) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN v_balance;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_employee_leave_balance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_employee_leave_balance(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_leave_balance(uuid, uuid) TO service_role;

DROP FUNCTION IF EXISTS public.get_employee_leave_balance(uuid);