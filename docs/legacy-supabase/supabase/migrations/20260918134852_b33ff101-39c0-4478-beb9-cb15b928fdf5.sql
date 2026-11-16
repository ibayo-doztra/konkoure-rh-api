-- 1. Le créateur d'une organisation doit pouvoir relire sa ligne (INSERT ... RETURNING).
DROP POLICY IF EXISTS "Orgs: creator read" ON public.organizations;
CREATE POLICY "Orgs: creator read"
  ON public.organizations FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- 2. Droits manquants (les policies existent déjà, seuls les GRANT manquaient).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;

-- 3. Création d'une fiche employé réservée au propriétaire et aux RH.
DROP POLICY IF EXISTS "employees: members write" ON public.employees;
CREATE POLICY "employees: admins write"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (private.is_org_admin(auth.uid(), organization_id));

-- 4. Aucun accès visiteur sur les tables sensibles sans policy anon.
REVOKE ALL ON public.audit_log FROM anon;
REVOKE ALL ON public.billing_audit_log FROM anon;
REVOKE ALL ON public.leave_requests FROM anon;
REVOKE ALL ON public.nfc_badge_history FROM anon;
REVOKE ALL ON public.okr_checkins FROM anon;
REVOKE ALL ON public.platform_admins FROM anon;
REVOKE ALL ON public.platform_settings FROM anon;
REVOKE ALL ON public.public_holidays FROM anon;
REVOKE ALL ON public.recruitment_webhook_configs FROM anon;
REVOKE ALL ON public.subscription_payments FROM anon;
REVOKE ALL ON public.system_log FROM anon;
REVOKE ALL ON public.usage_events FROM anon;

-- 5. Réglage « modules ouverts pour les tests ».
INSERT INTO public.platform_settings (key, value, description)
VALUES ('modules_open_for_testing', 'true'::jsonb,
        'Ouvre tous les modules à toutes les organisations (phase de test). Mettre false pour rétablir les limites par offre.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

CREATE OR REPLACE FUNCTION private.org_has_module(_org uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN COALESCE(
           (SELECT s.value = 'true'::jsonb FROM public.platform_settings s
             WHERE s.key = 'modules_open_for_testing'),
           false)
      THEN EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _org)
    ELSE COALESCE(
      (
        SELECT CASE
          WHEN p.code IS NOT NULL AND p.code <> 'gratuit'
               AND (o.statut_abo IN ('active','trialing')
                    OR (o.statut_abo = 'canceled' AND o.periode_fin IS NOT NULL AND o.periode_fin > now()))
            THEN (p.features->'modules') ? _module
          WHEN o.created_at > now() - interval '30 days'
            THEN (SELECT (g.features->'modules') ? _module FROM public.plans g WHERE g.code = 'gratuit')
          ELSE
            (SELECT (g.features->'modules_after_trial') ? _module FROM public.plans g WHERE g.code = 'gratuit')
        END
        FROM public.organizations o
        LEFT JOIN public.plans p ON p.id = o.plan_id
        WHERE o.id = _org
      ),
      false
    )
  END;
$function$;