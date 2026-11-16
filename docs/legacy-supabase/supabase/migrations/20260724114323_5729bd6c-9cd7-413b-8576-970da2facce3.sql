
-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Ajout solde de congés
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS leave_balance numeric(6,2) NOT NULL DEFAULT 0.00;

-- 2. Enums
DO $$ BEGIN
  CREATE TYPE public.leave_type AS ENUM ('annuel','maladie','maternite','sans_solde');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.leave_status AS ENUM ('pending','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. public_holidays
CREATE TABLE IF NOT EXISTS public.public_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  date date NOT NULL,
  is_movable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, date)
);
CREATE INDEX IF NOT EXISTS public_holidays_org_date_idx
  ON public.public_holidays (organization_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_holidays TO authenticated;
GRANT ALL ON public.public_holidays TO service_role;

ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_holidays: members read"
  ON public.public_holidays FOR SELECT TO authenticated
  USING (private.is_org_member(auth.uid(), organization_id));

CREATE POLICY "public_holidays: admins insert"
  ON public.public_holidays FOR INSERT TO authenticated
  WITH CHECK (private.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "public_holidays: admins update"
  ON public.public_holidays FOR UPDATE TO authenticated
  USING (private.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (private.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "public_holidays: admins delete"
  ON public.public_holidays FOR DELETE TO authenticated
  USING (private.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER public_holidays_set_updated_at
  BEFORE UPDATE ON public.public_holidays
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. leave_requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type public.leave_type NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  requested_days numeric(5,2) NOT NULL DEFAULT 0,
  status public.leave_status NOT NULL DEFAULT 'pending',
  reason text,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_requests_dates_chk CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS leave_requests_org_status_idx
  ON public.leave_requests (organization_id, status);
CREATE INDEX IF NOT EXISTS leave_requests_employee_idx
  ON public.leave_requests (employee_id);
CREATE INDEX IF NOT EXISTS leave_requests_range_idx
  ON public.leave_requests (organization_id, start_date, end_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Helper: is caller the given employee?
CREATE OR REPLACE FUNCTION private.is_self_employee(_user uuid, _employee uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = _employee AND e.user_id = _user)
$$;

-- Helper: does caller manage the department of the employee?
CREATE OR REPLACE FUNCTION private.is_employee_manager(_user uuid, _employee uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    JOIN public.departments d ON d.id = e.department_id
    JOIN public.employees m ON m.id = d.manager_id
    WHERE e.id = _employee AND m.user_id = _user
  )
$$;

CREATE POLICY "leave_requests: read own or team or admin"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (
    private.is_org_admin(auth.uid(), organization_id)
    OR private.is_self_employee(auth.uid(), employee_id)
    OR private.is_employee_manager(auth.uid(), employee_id)
  );

CREATE POLICY "leave_requests: insert own or admin"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    private.is_org_admin(auth.uid(), organization_id)
    OR private.is_self_employee(auth.uid(), employee_id)
  );

CREATE POLICY "leave_requests: update admin manager or owner"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (
    private.is_org_admin(auth.uid(), organization_id)
    OR private.is_employee_manager(auth.uid(), employee_id)
    OR private.is_self_employee(auth.uid(), employee_id)
  )
  WITH CHECK (
    private.is_org_admin(auth.uid(), organization_id)
    OR private.is_employee_manager(auth.uid(), employee_id)
    OR private.is_self_employee(auth.uid(), employee_id)
  );

CREATE POLICY "leave_requests: delete own pending or admin"
  ON public.leave_requests FOR DELETE TO authenticated
  USING (
    private.is_org_admin(auth.uid(), organization_id)
    OR (private.is_self_employee(auth.uid(), employee_id) AND status = 'pending')
  );

-- Trigger: cohérence organization_id / employé
CREATE OR REPLACE FUNCTION public.leave_requests_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.employees WHERE id = NEW.employee_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Employé introuvable' USING ERRCODE = 'check_violation';
  END IF;
  IF v_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'organization_id incohérent avec l''employé' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER leave_requests_validate_org
  BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.leave_requests_validate();

-- Trigger: employé ne peut pas changer status lui-même
CREATE OR REPLACE FUNCTION public.leave_requests_guard_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_is_manager boolean := false;
  v_is_self boolean := false;
BEGIN
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  v_is_admin := private.is_org_admin(v_uid, NEW.organization_id);
  v_is_manager := private.is_employee_manager(v_uid, NEW.employee_id);
  v_is_self := private.is_self_employee(v_uid, NEW.employee_id);

  IF v_is_self AND NOT v_is_admin AND NOT v_is_manager THEN
    -- Employé peut uniquement passer pending -> cancelled sur sa propre demande.
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

  -- Debit du solde à l'approbation d'un congé annuel
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'approved' AND OLD.status <> 'approved'
     AND NEW.type = 'annuel' THEN
    UPDATE public.employees
       SET leave_balance = leave_balance - NEW.requested_days
     WHERE id = NEW.employee_id;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER leave_requests_guard
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.leave_requests_guard_status();

CREATE TRIGGER leave_requests_set_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Calcul jours ouvrables
CREATE OR REPLACE FUNCTION public.compute_working_days(
  p_org uuid, p_start date, p_end date
) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count numeric := 0;
  v_day date;
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
    RETURN 0;
  END IF;
  FOR v_day IN SELECT generate_series(p_start, p_end, interval '1 day')::date LOOP
    -- 6 = Saturday, 0 = Sunday (dow)
    IF EXTRACT(DOW FROM v_day) IN (0, 6) THEN CONTINUE; END IF;
    IF EXISTS (
      SELECT 1 FROM public.public_holidays h
      WHERE h.organization_id = p_org AND h.date = v_day
    ) THEN CONTINUE; END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.compute_working_days(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_working_days(uuid, date, date) TO authenticated;

-- 6. Cumul mensuel
CREATE OR REPLACE FUNCTION public.accrue_monthly_leave()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.employees
     SET leave_balance = leave_balance + 2.5
   WHERE status = 'active';
END $$;

REVOKE ALL ON FUNCTION public.accrue_monthly_leave() FROM PUBLIC;

-- 7. Seed des jours fériés fixes par organisation
CREATE OR REPLACE FUNCTION public.seed_fixed_holidays_for_org(p_org uuid, p_year int DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_year int := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::int);
BEGIN
  INSERT INTO public.public_holidays (organization_id, name, date, is_movable) VALUES
    (p_org, 'Nouvel An',                                     make_date(v_year, 1,  1),  false),
    (p_org, 'Fête du Travail',                               make_date(v_year, 5,  1),  false),
    (p_org, 'Anniversaire de l''Union Africaine',            make_date(v_year, 5, 25),  false),
    (p_org, 'Assomption',                                    make_date(v_year, 8, 15),  false),
    (p_org, 'Fête de l''Indépendance de la Guinée',          make_date(v_year, 10, 2),  false),
    (p_org, 'Noël',                                          make_date(v_year, 12, 25), false)
  ON CONFLICT (organization_id, date) DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION public.seed_fixed_holidays_for_org(uuid, int) FROM PUBLIC;

-- Seed pour toutes les organisations existantes (année en cours et suivante)
DO $$
DECLARE r record; v_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
BEGIN
  FOR r IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_fixed_holidays_for_org(r.id, v_year);
    PERFORM public.seed_fixed_holidays_for_org(r.id, v_year + 1);
  END LOOP;
END $$;

-- Trigger de seed automatique à la création d'une organisation
CREATE OR REPLACE FUNCTION public.organizations_seed_holidays()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
BEGIN
  PERFORM public.seed_fixed_holidays_for_org(NEW.id, v_year);
  PERFORM public.seed_fixed_holidays_for_org(NEW.id, v_year + 1);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS organizations_seed_holidays_trg ON public.organizations;
CREATE TRIGGER organizations_seed_holidays_trg
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.organizations_seed_holidays();

-- 8. Cron mensuel (1er du mois à 2h)
DO $$
BEGIN
  PERFORM cron.unschedule('accrue-monthly-leave')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'accrue-monthly-leave');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'accrue-monthly-leave',
  '0 2 1 * *',
  $$SELECT public.accrue_monthly_leave();$$
);
