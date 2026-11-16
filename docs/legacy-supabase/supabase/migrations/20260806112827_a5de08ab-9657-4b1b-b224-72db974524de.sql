CREATE OR REPLACE FUNCTION private.org_has_module(_org uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN o.statut_abo IN ('active','trialing')
          THEN (p.features->'modules') ? _module
        ELSE (
          SELECT (g.features->'modules') ? _module
          FROM public.plans g WHERE g.code = 'gratuit'
        )
      END
      FROM public.organizations o
      LEFT JOIN public.plans p ON p.id = o.plan_id
      WHERE o.id = _org
    ),
    (
      SELECT (g.features->'modules') ? _module
      FROM public.plans g WHERE g.code = 'gratuit'
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION private.org_has_module(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.org_has_module(uuid, text) TO authenticated;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('jobs','recruitment'),
      ('candidates','recruitment'),
      ('candidate_notes','recruitment'),
      ('candidate_activities','recruitment'),
      ('recruitment_webhook_configs','recruitment'),
      ('goals','performance'),
      ('goal_activities','performance'),
      ('okrs','performance'),
      ('achievements','performance'),
      ('feedbacks','performance'),
      ('performance_cycles','performance'),
      ('performance_plans','performance'),
      ('performance_reviews','performance'),
      ('review_goal_comments','performance'),
      ('reviews','performance'),
      ('skills','talents'),
      ('employee_skills','talents'),
      ('succession_plans','talents'),
      ('leave_requests','leaves'),
      ('public_holidays','leaves'),
      ('contracts','contracts'),
      ('social_accounts','integrations'),
      ('social_posts','integrations')
    ) AS t(tbl, module)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'plan module gate', r.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (private.org_has_module(organization_id, %L)) WITH CHECK (private.org_has_module(organization_id, %L))',
      'plan module gate', r.tbl, r.module, r.module
    );
  END LOOP;
END $$;