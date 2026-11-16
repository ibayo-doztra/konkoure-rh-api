
-- 1) employees INSERT: prevent non-admins from setting arbitrary user_id
DROP POLICY IF EXISTS "employees: members write" ON public.employees;
CREATE POLICY "employees: members write"
ON public.employees
FOR INSERT
TO public
WITH CHECK (
  private.is_org_member(auth.uid(), organization_id)
  AND (
    private.is_org_admin(auth.uid(), organization_id)
    OR user_id IS NULL
    OR user_id = auth.uid()
  )
);

-- 2) candidate_activities: validate candidate belongs to declared organization
CREATE OR REPLACE FUNCTION public.candidate_activities_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.candidates WHERE id = NEW.candidate_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Candidat introuvable' USING ERRCODE = 'check_violation';
  END IF;
  IF v_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'organization_id incohérent avec le candidat' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS candidate_activities_validate_trg ON public.candidate_activities;
CREATE TRIGGER candidate_activities_validate_trg
BEFORE INSERT OR UPDATE ON public.candidate_activities
FOR EACH ROW EXECUTE FUNCTION public.candidate_activities_validate();

-- 3) social_accounts: forbid token-shaped keys in metadata jsonb (defence in depth;
--    real tokens live in private.social_account_tokens and are not readable via the Data API).
CREATE OR REPLACE FUNCTION public.social_accounts_scrub_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  k text;
  forbidden text[] := ARRAY[
    'access_token','refresh_token','id_token','token','client_secret',
    'app_secret','secret','password','private_key'
  ];
BEGIN
  IF NEW.metadata IS NULL THEN
    RETURN NEW;
  END IF;
  FOREACH k IN ARRAY forbidden LOOP
    IF NEW.metadata ? k THEN
      RAISE EXCEPTION 'metadata ne peut pas contenir de champ sensible (%)', k
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS social_accounts_scrub_metadata_trg ON public.social_accounts;
CREATE TRIGGER social_accounts_scrub_metadata_trg
BEFORE INSERT OR UPDATE ON public.social_accounts
FOR EACH ROW EXECUTE FUNCTION public.social_accounts_scrub_metadata();
