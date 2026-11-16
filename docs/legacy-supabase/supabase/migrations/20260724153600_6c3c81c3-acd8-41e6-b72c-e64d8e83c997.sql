
-- Fonction utilitaire d'ajustement du solde
CREATE OR REPLACE FUNCTION public._leave_balance_adjust(p_employee uuid, p_delta numeric)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.employees
     SET leave_balance = leave_balance + p_delta
   WHERE id = p_employee;
$$;

-- Remplacement du trigger BEFORE UPDATE : gestion symétrique
CREATE OR REPLACE FUNCTION public.leave_requests_guard_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_is_manager boolean := false;
  v_is_self boolean := false;
  v_old_debit numeric := 0;
  v_new_debit numeric := 0;
BEGIN
  IF v_uid IS NOT NULL THEN
    v_is_admin := private.is_org_admin(v_uid, NEW.organization_id);
    v_is_manager := private.is_employee_manager(v_uid, NEW.employee_id);
    v_is_self := private.is_self_employee(v_uid, NEW.employee_id);

    IF v_is_self AND NOT v_is_admin AND NOT v_is_manager THEN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT (OLD.status = 'pending' AND NEW.status = 'cancelled') THEN
          RAISE EXCEPTION 'Seul un manager ou un administrateur peut approuver ou refuser une demande'
            USING ERRCODE = '42501';
        END IF;
      END IF;
      IF NEW.decided_by IS DISTINCT FROM OLD.decided_by
         OR NEW.decided_at IS DISTINCT FROM OLD.decided_at THEN
        RAISE EXCEPTION 'Champs de décision réservés au manager ou à l''administrateur'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- Ajustement symétrique du solde (uniquement pour les congés annuels approuvés)
  IF OLD.status = 'approved' AND OLD.type = 'annuel' THEN
    v_old_debit := COALESCE(OLD.requested_days, 0);
  END IF;
  IF NEW.status = 'approved' AND NEW.type = 'annuel' THEN
    v_new_debit := COALESCE(NEW.requested_days, 0);
  END IF;

  IF v_new_debit <> v_old_debit THEN
    -- delta appliqué = -(new - old) ; on rembourse l'ancien débit et on applique le nouveau
    PERFORM public._leave_balance_adjust(NEW.employee_id, v_old_debit - v_new_debit);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger AFTER INSERT : débit direct si créée déjà approuvée
CREATE OR REPLACE FUNCTION public.leave_requests_after_insert_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND NEW.type = 'annuel' THEN
    PERFORM public._leave_balance_adjust(NEW.employee_id, -COALESCE(NEW.requested_days, 0));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leave_requests_after_insert_balance ON public.leave_requests;
CREATE TRIGGER leave_requests_after_insert_balance
  AFTER INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.leave_requests_after_insert_balance();

-- Trigger BEFORE DELETE : recrédite si suppression d'une demande approuvée
CREATE OR REPLACE FUNCTION public.leave_requests_before_delete_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'approved' AND OLD.type = 'annuel' THEN
    PERFORM public._leave_balance_adjust(OLD.employee_id, COALESCE(OLD.requested_days, 0));
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS leave_requests_before_delete_balance ON public.leave_requests;
CREATE TRIGGER leave_requests_before_delete_balance
  BEFORE DELETE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.leave_requests_before_delete_balance();
