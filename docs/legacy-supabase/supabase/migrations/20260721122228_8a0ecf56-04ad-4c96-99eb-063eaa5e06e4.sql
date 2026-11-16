
-- Guard: prevent an employee from writing manager-only fields on their own performance_reviews / reviews rows.

CREATE OR REPLACE FUNCTION public.performance_reviews_guard_manager_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_is_manager boolean := false;
  v_is_employee boolean := false;
BEGIN
  -- service_role / no auth context (e.g. server-side admin) bypass
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_admin := private.is_org_admin(v_uid, NEW.organization_id);

  IF NEW.manager_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.employees m WHERE m.id = NEW.manager_id AND m.user_id = v_uid)
      INTO v_is_manager;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = NEW.employee_id AND e.user_id = v_uid)
    INTO v_is_employee;

  -- If the caller is only the employee (not admin, not the assigned manager),
  -- disallow any change to manager-only columns and to submission status.
  IF v_is_employee AND NOT v_is_admin AND NOT v_is_manager THEN
    IF NEW.manager_score IS DISTINCT FROM OLD.manager_score
       OR NEW.manager_global_comment IS DISTINCT FROM OLD.manager_global_comment
       OR NEW.manager_submitted_at IS DISTINCT FROM OLD.manager_submitted_at
       OR NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
      RAISE EXCEPTION 'Seul le manager ou un administrateur peut modifier les champs manager de l''évaluation'
        USING ERRCODE = '42501';
    END IF;
    -- Employee may only move status among their own values (not_started/in_progress/submitted)
    -- but must not revert a manager-submitted review. If manager already submitted, freeze status.
    IF OLD.manager_submitted_at IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Évaluation clôturée par le manager, statut non modifiable'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS performance_reviews_guard_manager_fields ON public.performance_reviews;
CREATE TRIGGER performance_reviews_guard_manager_fields
BEFORE UPDATE ON public.performance_reviews
FOR EACH ROW EXECUTE FUNCTION public.performance_reviews_guard_manager_fields();


-- Same guard for the legacy public.reviews table
CREATE OR REPLACE FUNCTION public.reviews_guard_manager_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_is_employee boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_admin := private.is_org_admin(v_uid, NEW.organization_id);

  SELECT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = NEW.employee_id AND e.user_id = v_uid)
    INTO v_is_employee;

  IF v_is_employee AND NOT v_is_admin THEN
    IF NEW.manager_text     IS DISTINCT FROM OLD.manager_text
       OR NEW.ai_summary        IS DISTINCT FROM OLD.ai_summary
       OR NEW.performance_score IS DISTINCT FROM OLD.performance_score
       OR NEW.potential_score   IS DISTINCT FROM OLD.potential_score
       OR NEW.status            IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Seul un administrateur peut modifier les champs manager de la review'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_guard_manager_fields ON public.reviews;
CREATE TRIGGER reviews_guard_manager_fields
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.reviews_guard_manager_fields();
