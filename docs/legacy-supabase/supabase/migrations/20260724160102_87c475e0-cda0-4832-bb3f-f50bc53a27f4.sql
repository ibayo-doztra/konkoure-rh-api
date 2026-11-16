
CREATE OR REPLACE FUNCTION public.seed_movable_holidays_for_org(p_org uuid, p_year integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year int := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  r RECORD;
BEGIN
  IF v_year <> 2026 THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('Laylatoul Ghadr (Nuit du Destin)', make_date(2026, 3, 16)),
      ('Aïd el-Fitr (Korité)',             make_date(2026, 3, 20)),
      ('Lundi de Pâques',                  make_date(2026, 4, 6)),
      ('Aïd el-Adha (Tabaski)',            make_date(2026, 5, 27)),
      ('Lendemain de Tabaski',             make_date(2026, 5, 28)),
      ('Mawlid (Naissance du Prophète)',   make_date(2026, 8, 26))
    ) AS t(name, d)
  LOOP
    INSERT INTO public.public_holidays (organization_id, name, date, is_movable)
    VALUES (p_org, r.name, r.d, true)
    ON CONFLICT (organization_id, date) DO NOTHING;
  END LOOP;
END;
$function$;

-- Backfill : retire Ascension et Lundi de Pentecôte
DELETE FROM public.public_holidays
 WHERE is_movable = true
   AND date IN (make_date(2026, 5, 14), make_date(2026, 5, 25));

-- Retire le suffixe " (à confirmer)" des noms existants
UPDATE public.public_holidays
   SET name = regexp_replace(name, '\s*\(à confirmer\)\s*$', '')
 WHERE name ~ '\(à confirmer\)\s*$';

-- Ajoute Lendemain de Tabaski à toutes les organisations existantes
INSERT INTO public.public_holidays (organization_id, name, date, is_movable)
SELECT o.id, 'Lendemain de Tabaski', make_date(2026, 5, 28), true
  FROM public.organizations o
ON CONFLICT (organization_id, date) DO NOTHING;
