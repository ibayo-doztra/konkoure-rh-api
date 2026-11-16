-- Filet de sécurité : exiger employee_id sur achievements, okrs, goal_activities

CREATE OR REPLACE FUNCTION public.achievements_require_employee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.employee_id IS NULL THEN
    RAISE EXCEPTION 'Une réalisation doit être rattachée à un employé (employee_id)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS achievements_require_employee_trg ON public.achievements;
CREATE TRIGGER achievements_require_employee_trg
BEFORE INSERT OR UPDATE ON public.achievements
FOR EACH ROW EXECUTE FUNCTION public.achievements_require_employee();

CREATE OR REPLACE FUNCTION public.okrs_require_employee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.employee_id IS NULL THEN
    RAISE EXCEPTION 'Un OKR doit être rattaché à un employé (employee_id)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS okrs_require_employee_trg ON public.okrs;
CREATE TRIGGER okrs_require_employee_trg
BEFORE INSERT OR UPDATE ON public.okrs
FOR EACH ROW EXECUTE FUNCTION public.okrs_require_employee();

CREATE OR REPLACE FUNCTION public.goal_activities_require_employee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.employee_id IS NULL THEN
    RAISE EXCEPTION 'Une activité doit être rattachée à un employé (employee_id)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS goal_activities_require_employee_trg ON public.goal_activities;
CREATE TRIGGER goal_activities_require_employee_trg
BEFORE INSERT OR UPDATE ON public.goal_activities
FOR EACH ROW EXECUTE FUNCTION public.goal_activities_require_employee();