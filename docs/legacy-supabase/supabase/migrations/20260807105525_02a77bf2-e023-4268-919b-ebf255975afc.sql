-- 1. Platform admins
CREATE TABLE public.platform_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'root' CHECK (level IN ('root','support')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER platform_admins_set_updated_at BEFORE UPDATE ON public.platform_admins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_admins (user_id, level)
SELECT u.id, 'root' FROM auth.users u WHERE lower(u.email) = 'bayo.ibrahima@doztra.com'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins p
    WHERE p.user_id = _user_id AND p.is_active
  );
$$;
REVOKE ALL ON FUNCTION private.is_platform_admin(uuid) FROM PUBLIC, anon, authenticated;

-- 2. Platform settings
CREATE TABLE public.platform_settings (
  key text NOT NULL PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER platform_settings_set_updated_at BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_settings (key, value, description) VALUES
  ('demo_request_email', '"bayo.ibrahima@doztra.com"'::jsonb, 'Destinataire des demandes de démo'),
  ('email_from', '"Konkouré RH <onboarding@resend.dev>"'::jsonb, 'Expéditeur des e-mails transactionnels'),
  ('trial_days', '30'::jsonb, 'Durée de l''essai gratuit (jours)'),
  ('default_currency', '"GNF"'::jsonb, 'Devise par défaut'),
  ('default_timezone', '"Africa/Conakry"'::jsonb, 'Fuseau horaire par défaut'),
  ('maintenance_mode', 'false'::jsonb, 'Mode maintenance de la plateforme'),
  ('disabled_modules', '[]'::jsonb, 'Modules désactivés au niveau plateforme'),
  ('log_retention_days', '90'::jsonb, 'Rétention des journaux (jours)')
ON CONFLICT (key) DO NOTHING;

-- 3. Audit log
CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id uuid,
  actor_email text,
  organization_id uuid,
  action text NOT NULL,
  target_type text,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX audit_log_org_idx ON public.audit_log (organization_id, created_at DESC);
CREATE INDEX audit_log_action_idx ON public.audit_log (action);

-- 4. Usage events
CREATE TABLE public.usage_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid,
  user_id uuid,
  kind text NOT NULL,
  path text,
  module text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX usage_events_created_at_idx ON public.usage_events (created_at DESC);
CREATE INDEX usage_events_org_idx ON public.usage_events (organization_id, created_at DESC);

-- 5. System log
CREATE TABLE public.system_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel text NOT NULL,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('debug','info','warn','error')),
  message text NOT NULL,
  organization_id uuid,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_code integer,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.system_log TO service_role;
ALTER TABLE public.system_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX system_log_created_at_idx ON public.system_log (created_at DESC);
CREATE INDEX system_log_channel_idx ON public.system_log (channel, created_at DESC);
CREATE INDEX system_log_level_idx ON public.system_log (level);

-- 6. Organization overrides
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS max_employes_override integer,
  ADD COLUMN IF NOT EXISTS modules_override jsonb;
