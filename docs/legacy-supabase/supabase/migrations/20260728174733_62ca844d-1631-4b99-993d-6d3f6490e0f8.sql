-- 1) Restrict anonymous exposure of organizations to public-facing columns only
REVOKE SELECT ON public.organizations FROM anon;
GRANT SELECT (id, name, slug, logo_url) ON public.organizations TO anon;

-- 2) Prevent non-admin members from setting sensitive fields when creating an employee row
CREATE OR REPLACE FUNCTION public.employees_guard_insert_sensitive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;
  IF private.is_org_admin(v_uid, NEW.organization_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.base_salary IS NOT NULL
     OR NEW.department_id IS NOT NULL
     OR NEW.manager_id IS NOT NULL
     OR NEW.nfc_badge_uid IS NOT NULL THEN
    RAISE EXCEPTION 'Seul un administrateur peut définir le salaire, le département, le manager ou le badge NFC d''un employé'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.employees_guard_insert_sensitive() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS employees_guard_insert_sensitive ON public.employees;
CREATE TRIGGER employees_guard_insert_sensitive
BEFORE INSERT ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.employees_guard_insert_sensitive();