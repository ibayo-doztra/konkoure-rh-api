
CREATE OR REPLACE FUNCTION public.seed_movable_holidays_for_org(p_org uuid, p_year int DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  r RECORD;
  v_name text;
BEGIN
  -- Only 2026 dates are known/reliable in this seeder. Skip other years silently.
  IF v_year <> 2026 THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('Laylat al-Qadr (Nuit du Destin)', make_date(2026, 3, 16)),
      ('Aïd el-Fitr (Korité)',            make_date(2026, 3, 20)),
      ('Lundi de Pâques',                 make_date(2026, 4, 6)),
      ('Ascension',                       make_date(2026, 5, 14)),
      ('Lundi de Pentecôte',              make_date(2026, 5, 25)),
      ('Aïd el-Adha (Tabaski)',           make_date(2026, 5, 27)),
      ('Mawlid (Naissance du Prophète)',  make_date(2026, 8, 26))
    ) AS t(name, d)
  LOOP
    v_name := CASE WHEN r.d >= CURRENT_DATE THEN r.name || ' (à confirmer)' ELSE r.name END;
    INSERT INTO public.public_holidays (organization_id, name, date, is_movable)
    VALUES (p_org, v_name, r.d, true)
    ON CONFLICT (organization_id, date) DO NOTHING;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_movable_holidays_for_org(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_movable_holidays_for_org(uuid, int) TO service_role;

-- Extend org-creation seeder to also insert movable holidays for the current year
CREATE OR REPLACE FUNCTION public.organizations_seed_holidays()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
BEGIN
  PERFORM public.seed_fixed_holidays_for_org(NEW.id, v_year);
  PERFORM public.seed_fixed_holidays_for_org(NEW.id, v_year + 1);
  PERFORM public.seed_movable_holidays_for_org(NEW.id, v_year);
  RETURN NEW;
END $$;

-- Backfill all existing organizations for 2026
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_movable_holidays_for_org(r.id, 2026);
  END LOOP;
END $$;
