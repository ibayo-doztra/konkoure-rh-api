
CREATE TABLE IF NOT EXISTS private.cron_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO private.cron_tokens(name) VALUES ('billing')
ON CONFLICT (name) DO NOTHING;

REVOKE ALL ON private.cron_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.cron_tokens TO service_role;
