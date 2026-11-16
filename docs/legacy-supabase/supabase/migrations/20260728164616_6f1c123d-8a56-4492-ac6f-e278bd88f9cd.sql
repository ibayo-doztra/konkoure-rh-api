
CREATE OR REPLACE FUNCTION public.employees_enforce_plan_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max int;
  v_count int;
BEGIN
  SELECT p.max_employes INTO v_max
    FROM public.organizations o
    JOIN public.plans p ON p.id = o.plan_id
   WHERE o.id = NEW.organization_id;

  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
    FROM public.employees e
   WHERE e.organization_id = NEW.organization_id
     AND e.status <> 'terminated';

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Plafond de % employés atteint pour votre offre. Passez à une offre supérieure pour en ajouter davantage.', v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.employees_enforce_plan_quota() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER employees_enforce_plan_quota
BEFORE INSERT ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.employees_enforce_plan_quota();
