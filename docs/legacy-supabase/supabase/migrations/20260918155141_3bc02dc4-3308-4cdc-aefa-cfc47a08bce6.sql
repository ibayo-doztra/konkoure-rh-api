ALTER TABLE public.organizations ALTER COLUMN default_currency SET DEFAULT 'GNF';
ALTER TABLE public.contracts ALTER COLUMN currency SET DEFAULT 'GNF';
UPDATE public.organizations SET default_currency = 'GNF' WHERE default_currency IS DISTINCT FROM 'GNF';
UPDATE public.contracts SET currency = 'GNF' WHERE currency IS NOT NULL AND currency <> 'GNF';