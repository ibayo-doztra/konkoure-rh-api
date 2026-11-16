-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- DEPARTMENTS
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS manager_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_departments_updated_at ON public.departments;
CREATE TRIGGER trg_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- EMPLOYEES
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS base_salary numeric,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_org_email_unique'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_org_email_unique UNIQUE (organization_id, email);
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_employees_updated_at ON public.employees;
CREATE TRIGGER trg_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- CONTRACTS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_status') THEN
    CREATE TYPE public.contract_status AS ENUM ('draft', 'active', 'terminated');
  END IF;
END$$;

-- Extend contract_type enum with 'Journalier' if not present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_type') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'contract_type' AND e.enumlabel = 'Journalier'
    ) THEN
      ALTER TYPE public.contract_type ADD VALUE 'Journalier';
    END IF;
  END IF;
END$$;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS trial_period_end date,
  ADD COLUMN IF NOT EXISTS document_url text,
  ADD COLUMN IF NOT EXISTS status public.contract_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_contracts_updated_at ON public.contracts;
CREATE TRIGGER trg_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;