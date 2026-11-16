CREATE OR REPLACE FUNCTION public._leave_balance_adjust(p_employee uuid, p_delta numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_balance numeric;
BEGIN
  SELECT leave_balance INTO v_balance
    FROM public.employees
   WHERE id = p_employee
   FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Employé introuvable' USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE public.employees
     SET leave_balance = leave_balance + p_delta
   WHERE id = p_employee;
END;
$function$;