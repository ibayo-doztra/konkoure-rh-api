CREATE OR REPLACE FUNCTION public.set_leave_request_status(p_request uuid, p_status text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS leave_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.leave_requests;
  v_uid uuid := COALESCE(auth.uid(), p_actor);
  v_is_admin boolean := false;
  v_is_manager boolean := false;
  v_is_self boolean := false;
BEGIN
  IF p_status NOT IN ('pending','approved','rejected','cancelled') THEN
    RAISE EXCEPTION 'Statut invalide: %', p_status USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_row FROM public.leave_requests WHERE id = p_request;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Demande introuvable' USING ERRCODE = 'no_data_found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('leave:' || v_row.employee_id::text, 0));

  IF v_uid IS NOT NULL THEN
    v_is_admin := private.is_org_admin(v_uid, v_row.organization_id);
    v_is_manager := private.is_employee_manager(v_uid, v_row.employee_id);
    v_is_self := private.is_self_employee(v_uid, v_row.employee_id);
  END IF;

  IF p_status IN ('approved','rejected') THEN
    IF NOT (v_is_admin OR v_is_manager) THEN
      RAISE EXCEPTION 'Non autorisé à décider de cette demande' USING ERRCODE = '42501';
    END IF;
  ELSIF p_status = 'cancelled' THEN
    IF NOT (v_is_admin OR v_is_manager OR v_is_self) THEN
      RAISE EXCEPTION 'Non autorisé à annuler cette demande' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.leave_requests
     SET status = p_status::public.leave_status,
         decided_by = CASE WHEN p_status IN ('approved','rejected') THEN v_uid ELSE decided_by END,
         decided_at = CASE WHEN p_status IN ('approved','rejected') THEN now() ELSE decided_at END
   WHERE id = p_request
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;