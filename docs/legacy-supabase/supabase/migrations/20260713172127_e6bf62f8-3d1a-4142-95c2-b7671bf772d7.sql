
-- 1) Trigger uses session-scoped actor when auth.uid() is null (service role path).
CREATE OR REPLACE FUNCTION public.employees_badge_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := COALESCE(
    auth.uid(),
    NULLIF(current_setting('app.actor_user_id', true), '')::uuid
  );
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.nfc_badge_uid IS NOT NULL THEN
      INSERT INTO public.nfc_badge_history(organization_id, employee_id, uid, event, actor_user_id)
      VALUES (NEW.organization_id, NEW.id, NEW.nfc_badge_uid, 'assigned', v_actor);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.nfc_badge_uid IS DISTINCT FROM OLD.nfc_badge_uid THEN
    IF OLD.nfc_badge_uid IS NOT NULL THEN
      INSERT INTO public.nfc_badge_history(organization_id, employee_id, uid, event, actor_user_id)
      VALUES (NEW.organization_id, NEW.id, OLD.nfc_badge_uid, 'revoked', v_actor);
    END IF;
    IF NEW.nfc_badge_uid IS NOT NULL THEN
      INSERT INTO public.nfc_badge_history(organization_id, employee_id, uid, event, actor_user_id)
      VALUES (NEW.organization_id, NEW.id, NEW.nfc_badge_uid, 'assigned', v_actor);
      NEW.nfc_badge_assigned_at := now();
    END IF;
  ELSIF NEW.nfc_badge_active IS DISTINCT FROM OLD.nfc_badge_active AND NEW.nfc_badge_uid IS NOT NULL THEN
    INSERT INTO public.nfc_badge_history(organization_id, employee_id, uid, event, actor_user_id)
    VALUES (NEW.organization_id, NEW.id, NEW.nfc_badge_uid,
            CASE WHEN NEW.nfc_badge_active THEN 'reactivated' ELSE 'deactivated' END,
            v_actor);
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) RPCs so the server function can pass the caller id and update in one transaction.
--    SECURITY DEFINER + explicit admin check via has_role-like lookup on user_roles.
CREATE OR REPLACE FUNCTION public.admin_assign_employee_badge(
  p_employee uuid,
  p_uid text,
  p_active boolean,
  p_actor uuid
)
RETURNS TABLE (
  id uuid,
  nfc_badge_uid text,
  nfc_badge_active boolean,
  nfc_badge_assigned_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_employee_badge(
  p_employee uuid,
  p_actor uuid
)
RETURNS TABLE (
  id uuid,
  nfc_badge_uid text,
  nfc_badge_active boolean,
  nfc_badge_assigned_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.admin_assign_employee_badge(uuid, text, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_revoke_employee_badge(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_employee_badge(uuid, text, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_employee_badge(uuid, uuid) TO service_role;
