
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.set_updated_at()',
    'public.handle_new_user()',
    'public.goals_require_owner()',
    'public.goal_activities_require_employee()',
    'public.okrs_require_employee()',
    'public.achievements_require_employee()',
    'public.reviews_require_plan_or_cycle()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;
