
-- ============ plans ============
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  nom text NOT NULL,
  prix_gnf numeric NOT NULL DEFAULT 0,
  max_employes integer NOT NULL DEFAULT 5,
  credits_ia_mois integer NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_read_authenticated" ON public.plans FOR SELECT TO authenticated USING (true);

CREATE TRIGGER plans_set_updated_at BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.plans (code, nom, prix_gnf, max_employes, credits_ia_mois, sort_order, features) VALUES
  ('gratuit',      'Gratuit',      0,       5,   50,   1, '{"modules":["employees","departments","timeclock"]}'::jsonb),
  ('essentiel',    'Essentiel',    440000,  25,  300,  2, '{"modules":["employees","departments","timeclock","leaves","contracts"]}'::jsonb),
  ('professionnel','Professionnel',1100000, 75,  1000, 3, '{"modules":["employees","departments","timeclock","leaves","contracts","recruitment","performance"]}'::jsonb),
  ('entreprise',   'Entreprise',   2200000, 200, 5000, 4, '{"modules":["employees","departments","timeclock","leaves","contracts","recruitment","performance","talents","integrations"]}'::jsonb);

-- ============ organizations : colonnes abonnement ============
ALTER TABLE public.organizations
  ADD COLUMN plan_id uuid REFERENCES public.plans(id),
  ADD COLUMN statut_abo text NOT NULL DEFAULT 'trialing',
  ADD COLUMN periode_fin timestamptz,
  ADD COLUMN cycle text NOT NULL DEFAULT 'mensuel';

UPDATE public.organizations o
   SET plan_id = (SELECT p.id FROM public.plans p WHERE p.code = 'gratuit');

CREATE OR REPLACE FUNCTION public.organizations_guard_subscription_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Seules les écritures serveur (service_role, sans contexte auth) peuvent
  -- modifier l'abonnement. Toute tentative depuis un utilisateur est refusée.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
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
$$;

CREATE TRIGGER organizations_guard_subscription
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.organizations_guard_subscription_columns();

REVOKE ALL ON FUNCTION public.organizations_guard_subscription_columns() FROM PUBLIC, anon, authenticated;

-- ============ subscription_payments ============
CREATE TABLE public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  cycle text NOT NULL,
  merchant_reference uuid NOT NULL UNIQUE,
  djomy_transaction_id text,
  expected_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'GNF',
  status text NOT NULL DEFAULT 'pending',
  method text,
  raw_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscription_payments_org_idx ON public.subscription_payments(org_id, created_at DESC);
CREATE INDEX subscription_payments_status_idx ON public.subscription_payments(status, created_at DESC);
GRANT SELECT ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_payments_read_own_org" ON public.subscription_payments
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.organization_members m
  WHERE m.organization_id = subscription_payments.org_id AND m.user_id = auth.uid()
));

CREATE TRIGGER subscription_payments_set_updated_at BEFORE UPDATE ON public.subscription_payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ webhook_events (idempotence) ============
CREATE TABLE public.webhook_events (
  event_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- ============ billing_audit_log ============
CREATE TABLE public.billing_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX billing_audit_log_org_idx ON public.billing_audit_log(org_id, created_at DESC);
GRANT ALL ON public.billing_audit_log TO service_role;
ALTER TABLE public.billing_audit_log ENABLE ROW LEVEL SECURITY;
