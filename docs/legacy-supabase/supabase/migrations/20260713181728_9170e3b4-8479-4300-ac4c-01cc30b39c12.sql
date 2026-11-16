
DROP FUNCTION IF EXISTS public.admin_assign_employee_badge(uuid, text, boolean, uuid);
DROP FUNCTION IF EXISTS public.admin_revoke_employee_badge(uuid, uuid);

CREATE OR REPLACE FUNCTION public.admin_assign_employee_badge(
  p_employee uuid,
  p_uid text,
  p_active boolean,
  p_actor uuid
)
RETURNS TABLE(
  out_id uuid,
  out_nfc_badge_uid text,
  out_nfc_badge_active boolean,
  out_nfc_badge_assigned_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_is_admin boolean;
BEGIN
  IF p_actor IS NULL THEN
    RAISE EXCEPTION 'actor_user_id requis';
  END IF;

  SELECT organization_id INTO v_org FROM public.employees WHERE id = p_employee;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Employé introuvable';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = p_actor
       AND organization_id = v_org
       AND role IN ('owner','hr_admin')
  ) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  PERFORM set_config('app.actor_user_id', p_actor::text, true);

  RETURN QUERY
  UPDATE public.employees e
     SET nfc_badge_uid = p_uid,
         nfc_badge_active = p_active
   WHERE e.id = p_employee
  RETURNING e.id, e.nfc_badge_uid, e.nfc_badge_active, e.nfc_badge_assigned_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_revoke_employee_badge(
  p_employee uuid,
  p_actor uuid
)
RETURNS TABLE(
  out_id uuid,
  out_nfc_badge_uid text,
  out_nfc_badge_active boolean,
  out_nfc_badge_assigned_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_is_admin boolean;
BEGIN
  IF p_actor IS NULL THEN
    RAISE EXCEPTION 'actor_user_id requis';
  END IF;

  SELECT organization_id INTO v_org FROM public.employees WHERE id = p_employee;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Employé introuvable';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = p_actor
       AND organization_id = v_org
       AND role IN ('owner','hr_admin')
  ) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  PERFORM set_config('app.actor_user_id', p_actor::text, true);

  RETURN QUERY
  UPDATE public.employees e
     SET nfc_badge_uid = NULL,
         nfc_badge_active = true
   WHERE e.id = p_employee
  RETURNING e.id, e.nfc_badge_uid, e.nfc_badge_active, e.nfc_badge_assigned_at;
END;
$function$;
