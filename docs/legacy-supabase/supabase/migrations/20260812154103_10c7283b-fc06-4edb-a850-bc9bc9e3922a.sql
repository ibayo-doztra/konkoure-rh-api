ALTER TYPE public.perf_review_status ADD VALUE IF NOT EXISTS 'sent_back';
ALTER TYPE public.perf_review_status ADD VALUE IF NOT EXISTS 'validated';
ALTER TYPE public.perf_review_status ADD VALUE IF NOT EXISTS 'signed';

ALTER TABLE public.performance_reviews ADD COLUMN IF NOT EXISTS signed_at timestamptz;

CREATE OR REPLACE FUNCTION public.performance_reviews_guard_manager_fields()
RETURNS trigger
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

  IF v_is_employee AND NOT v_is_admin AND NOT v_is_manager THEN
    IF NEW.manager_score IS DISTINCT FROM OLD.manager_score
       OR NEW.manager_global_comment IS DISTINCT FROM OLD.manager_global_comment
       OR NEW.manager_submitted_at IS DISTINCT FROM OLD.manager_submitted_at
       OR NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
      RAISE EXCEPTION 'Seul le manager ou un administrateur peut modifier les champs manager de l''évaluation'
        USING ERRCODE = '42501';
    END IF;

    -- L'employé peut signer une évaluation validée par le manager
    IF OLD.status::text = 'validated' AND NEW.status::text = 'signed' THEN
      RETURN NEW;
    END IF;

    IF OLD.manager_submitted_at IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Évaluation clôturée par le manager, statut non modifiable'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;