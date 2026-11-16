
CREATE TABLE public.recruitment_webhook_configs (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  test_webhook_url text,
  prod_webhook_url text,
  active_env text NOT NULL DEFAULT 'off' CHECK (active_env IN ('off','test','prod')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.recruitment_webhook_configs TO authenticated;
GRANT ALL ON public.recruitment_webhook_configs TO service_role;

ALTER TABLE public.recruitment_webhook_configs ENABLE ROW LEVEL SECURITY;

-- Members of the org can read only the active_env flag effectively; we allow SELECT,
-- but URLs will be stripped server-side for non-platform-admins.
CREATE POLICY "Org members can read webhook config"
ON public.recruitment_webhook_configs
FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

-- No INSERT/UPDATE/DELETE policies: all mutations go through the platform-admin serverFn (service_role).

CREATE TRIGGER trg_recruitment_webhook_configs_updated_at
BEFORE UPDATE ON public.recruitment_webhook_configs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
