
-- 1) Idempotence flag
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS balance_applied boolean NOT NULL DEFAULT false;

-- Backfill: reflect current state (approved annual => applied)
UPDATE public.leave_requests
   SET balance_applied = true
 WHERE status = 'approved' AND type = 'annuel' AND balance_applied = false;

-- 2) Row-locking helper
CREATE OR REPLACE FUNCTION public._leave_balance_adjust(p_employee uuid, p_delta numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  -- Serialize concurrent adjustments on the same employee row
  SELECT leave_balance INTO v_balance
    FROM public.employees
   WHERE id = p_employee
   FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Employé introuvable' USING ERRCODE = 'no_data_found';
  END IF;

  IF p_delta < 0 AND (v_balance + p_delta) < 0 THEN
    RAISE EXCEPTION 'Solde de congés insuffisant' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.employees
     SET leave_balance = leave_balance + p_delta
   WHERE id = p_employee;
END;
$$;

-- 3) AFTER INSERT: apply only if not already applied
CREATE OR REPLACE FUNCTION public.leave_requests_after_insert_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND NEW.type = 'annuel' AND NOT NEW.balance_applied THEN
    PERFORM public._leave_balance_adjust(NEW.employee_id, -COALESCE(NEW.requested_days, 0));
    UPDATE public.leave_requests
       SET balance_applied = true
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) BEFORE UPDATE guard + idempotent symmetric balance update
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
  v_should_apply boolean;
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

  -- Idempotent symmetric balance update, driven by balance_applied
  IF OLD.balance_applied THEN
    v_old_debit := COALESCE(OLD.requested_days, 0);
  END IF;

  v_should_apply := (NEW.status = 'approved' AND NEW.type = 'annuel');
  IF v_should_apply THEN
    v_new_debit := COALESCE(NEW.requested_days, 0);
  END IF;

  IF v_new_debit <> v_old_debit THEN
    -- Refund old debit, apply new one (single locked adjustment)
    PERFORM public._leave_balance_adjust(NEW.employee_id, v_old_debit - v_new_debit);
  END IF;

  NEW.balance_applied := v_should_apply;

  RETURN NEW;
END;
$$;

-- 5) BEFORE DELETE: refund only if applied
CREATE OR REPLACE FUNCTION public.leave_requests_before_delete_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.balance_applied THEN
    PERFORM public._leave_balance_adjust(OLD.employee_id, COALESCE(OLD.requested_days, 0));
  END IF;
  RETURN OLD;
END;
$$;

-- 6) Atomic status change RPC with per-employee advisory lock
CREATE OR REPLACE FUNCTION public.set_leave_request_status(
  p_request uuid,
  p_status text,
  p_actor uuid DEFAULT NULL
)
RETURNS public.leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Serialize concurrent decisions per employee
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
     SET status = p_status,
         decided_by = CASE WHEN p_status IN ('approved','rejected') THEN v_uid ELSE decided_by END,
         decided_at = CASE WHEN p_status IN ('approved','rejected') THEN now() ELSE decided_at END
   WHERE id = p_request
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_leave_request_status(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_leave_request_status(uuid, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public._leave_balance_adjust(uuid, numeric) FROM PUBLIC, anon, authenticated;
