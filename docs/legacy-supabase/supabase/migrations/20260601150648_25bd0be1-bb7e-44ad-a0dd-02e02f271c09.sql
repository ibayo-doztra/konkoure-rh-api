-- Empêcher la création/maj d'un objectif sans propriétaire
CREATE OR REPLACE FUNCTION public.goals_require_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    RAISE EXCEPTION 'Un objectif doit obligatoirement avoir un propriétaire (owner_id)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS goals_require_owner_trg ON public.goals;
CREATE TRIGGER goals_require_owner_trg
BEFORE INSERT OR UPDATE ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.goals_require_owner();