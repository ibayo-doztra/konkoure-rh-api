UPDATE public.plans
   SET features = jsonb_build_object(
         'modules', jsonb_build_array('employees','departments','timeclock','leaves','contracts','performance','integrations'),
         'modules_after_trial', jsonb_build_array('employees','departments')
       )
 WHERE code = 'gratuit';

CREATE OR REPLACE FUNCTION private.org_has_module(_org uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
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
  );
$function$;