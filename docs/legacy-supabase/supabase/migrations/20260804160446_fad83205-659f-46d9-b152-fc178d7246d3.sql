-- 1) organizations: add WITH CHECK so admins cannot move the row out of their scope,
--    and enforce subscription columns are server-only even for admins.
DROP POLICY IF EXISTS "Orgs: admins update" ON public.organizations;
CREATE POLICY "Orgs: admins update"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (private.is_org_admin(auth.uid(), id))
  WITH CHECK (private.is_org_admin(auth.uid(), id));

CREATE OR REPLACE FUNCTION public.organizations_guard_subscription_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only server-side writes (service_role, no auth context) may change billing data.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Identifiants d''organisation non modifiables'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
     OR NEW.statut_abo IS DISTINCT FROM OLD.statut_abo
     OR NEW.periode_fin IS DISTINCT FROM OLD.periode_fin
     OR NEW.cycle IS DISTINCT FROM OLD.cycle
     OR NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'Les informations d''abonnement ne peuvent être modifiées que par le serveur'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) candidate_activities: admin updates must keep the candidate/org relationship valid
DROP POLICY IF EXISTS "candidate_activities: admins update" ON public.candidate_activities;
CREATE POLICY "candidate_activities: admins update"
  ON public.candidate_activities
  FOR UPDATE
  TO authenticated
  USING (private.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (
    private.is_org_admin(auth.uid(), organization_id)
    AND EXISTS (
      SELECT 1 FROM public.candidates c
       WHERE c.id = candidate_activities.candidate_id
         AND c.organization_id = candidate_activities.organization_id
    )
  );