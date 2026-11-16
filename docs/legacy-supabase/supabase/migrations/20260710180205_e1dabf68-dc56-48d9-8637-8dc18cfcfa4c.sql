
-- 1. Add security_agent role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'security_agent';

-- 2. Employees: NFC badge columns
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS nfc_badge_uid text,
  ADD COLUMN IF NOT EXISTS nfc_badge_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nfc_badge_assigned_at timestamptz;

-- Unique active badge per organization
CREATE UNIQUE INDEX IF NOT EXISTS employees_active_badge_uid_uq
  ON public.employees (organization_id, nfc_badge_uid)
  WHERE nfc_badge_uid IS NOT NULL AND nfc_badge_active = true;

-- 3. NFC badge history table
CREATE TABLE IF NOT EXISTS public.nfc_badge_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  uid text NOT NULL,
  event text NOT NULL CHECK (event IN ('assigned','revoked','reactivated','deactivated')),
  reason text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.nfc_badge_history TO authenticated;
GRANT ALL ON public.nfc_badge_history TO service_role;

ALTER TABLE public.nfc_badge_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfc_history: admins read"
  ON public.nfc_badge_history FOR SELECT TO authenticated
  USING (private.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "nfc_history: admins insert"
  ON public.nfc_badge_history FOR INSERT TO authenticated
  WITH CHECK (private.is_org_admin(auth.uid(), organization_id));

CREATE INDEX IF NOT EXISTS nfc_badge_history_employee_idx
  ON public.nfc_badge_history (employee_id, created_at DESC);

-- 4. Audit trigger on employees badge changes
CREATE OR REPLACE FUNCTION public.employees_badge_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.nfc_badge_uid IS NOT NULL THEN
      INSERT INTO public.nfc_badge_history(organization_id, employee_id, uid, event, actor_user_id)
      VALUES (NEW.organization_id, NEW.id, NEW.nfc_badge_uid, 'assigned', auth.uid());
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.nfc_badge_uid IS DISTINCT FROM OLD.nfc_badge_uid THEN
    IF OLD.nfc_badge_uid IS NOT NULL THEN
      INSERT INTO public.nfc_badge_history(organization_id, employee_id, uid, event, actor_user_id)
      VALUES (NEW.organization_id, NEW.id, OLD.nfc_badge_uid, 'revoked', auth.uid());
    END IF;
    IF NEW.nfc_badge_uid IS NOT NULL THEN
      INSERT INTO public.nfc_badge_history(organization_id, employee_id, uid, event, actor_user_id)
      VALUES (NEW.organization_id, NEW.id, NEW.nfc_badge_uid, 'assigned', auth.uid());
      NEW.nfc_badge_assigned_at := now();
    END IF;
  ELSIF NEW.nfc_badge_active IS DISTINCT FROM OLD.nfc_badge_active AND NEW.nfc_badge_uid IS NOT NULL THEN
    INSERT INTO public.nfc_badge_history(organization_id, employee_id, uid, event, actor_user_id)
    VALUES (NEW.organization_id, NEW.id, NEW.nfc_badge_uid,
            CASE WHEN NEW.nfc_badge_active THEN 'reactivated' ELSE 'deactivated' END,
            auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_badge_audit_trg ON public.employees;
CREATE TRIGGER employees_badge_audit_trg
  BEFORE INSERT OR UPDATE OF nfc_badge_uid, nfc_badge_active ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.employees_badge_audit();

-- 5. SECURITY DEFINER resolver: returns employee for a scanned badge without exposing the uid column broadly
CREATE OR REPLACE FUNCTION public.resolve_nfc_badge(_org uuid, _uid text)
RETURNS TABLE(employee_id uuid, first_name text, last_name text, photo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.first_name, e.last_name, e.photo_url
  FROM public.employees e
  WHERE e.organization_id = _org
    AND e.nfc_badge_uid = _uid
    AND e.nfc_badge_active = true
    AND e.status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_nfc_badge(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_nfc_badge(uuid, text) TO authenticated;
