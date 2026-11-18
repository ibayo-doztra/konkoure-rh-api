import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Grants and residual RLS on the tables created so far (docs/backend/03 §8, 05 §1).
 *
 * - `invitations`: plain tenant isolation. The public accept flow first resolves
 *   the organization from the secret token through a narrow definer function.
 * - `user_roles`: readable without tenant, because the tenant middleware needs it
 *   to validate `X-Organization-Id`; writes stay tenant-bound.
 * - `audit_logs`: append-only. Rows without organization are authentication events.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
      TO konkoure_app, konkoure_worker
    `)
    this.schema.raw(`
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO konkoure_app, konkoure_worker
    `)
    this.schema.raw(`
      REVOKE INSERT, UPDATE, DELETE ON adonis_schema, adonis_schema_versions
      FROM konkoure_app, konkoure_worker
    `)
    this.schema.raw(`
      REVOKE UPDATE, DELETE ON audit_logs, audit_logs_default
      FROM konkoure_app, konkoure_worker
    `)

    this.schema.raw(`SELECT enable_tenant_rls('invitations')`)

    this.schema.raw('ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY')
    this.schema.raw(`
      CREATE POLICY user_roles_read ON user_roles FOR SELECT TO konkoure_app USING (true)
    `)
    this.schema.raw(`
      CREATE POLICY user_roles_insert ON user_roles FOR INSERT TO konkoure_app
      WITH CHECK (organization_id = current_org_id())
    `)
    this.schema.raw(`
      CREATE POLICY user_roles_update ON user_roles FOR UPDATE TO konkoure_app
      USING (organization_id = current_org_id())
      WITH CHECK (organization_id = current_org_id())
    `)
    this.schema.raw(`
      CREATE POLICY user_roles_delete ON user_roles FOR DELETE TO konkoure_app
      USING (organization_id = current_org_id())
    `)

    this.schema.raw('ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY')
    this.schema.raw(`
      CREATE POLICY audit_logs_read ON audit_logs FOR SELECT TO konkoure_app
      USING (organization_id IS NULL OR organization_id = current_org_id())
    `)
    this.schema.raw(`
      CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT TO konkoure_app
      WITH CHECK (organization_id IS NULL OR organization_id = current_org_id())
    `)

    this.schema.raw(`
      CREATE FUNCTION invitation_org_id_for_token(hash text) RETURNS uuid
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT organization_id FROM invitations WHERE token_hash = hash
      $$;
    `)
    this.schema.raw('REVOKE ALL ON FUNCTION invitation_org_id_for_token(text) FROM PUBLIC')
    this.schema.raw(
      'GRANT EXECUTE ON FUNCTION invitation_org_id_for_token(text) TO konkoure_app, konkoure_worker'
    )
  }

  async down() {
    this.schema.raw('DROP FUNCTION IF EXISTS invitation_org_id_for_token(text)')

    this.schema.raw('DROP POLICY IF EXISTS audit_logs_insert ON audit_logs')
    this.schema.raw('DROP POLICY IF EXISTS audit_logs_read ON audit_logs')
    this.schema.raw('ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY')

    this.schema.raw('DROP POLICY IF EXISTS user_roles_delete ON user_roles')
    this.schema.raw('DROP POLICY IF EXISTS user_roles_update ON user_roles')
    this.schema.raw('DROP POLICY IF EXISTS user_roles_insert ON user_roles')
    this.schema.raw('DROP POLICY IF EXISTS user_roles_read ON user_roles')
    this.schema.raw('ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY')

    this.schema.raw('DROP POLICY IF EXISTS tenant_isolation ON invitations')
    this.schema.raw('ALTER TABLE invitations DISABLE ROW LEVEL SECURITY')

    this.schema.raw(`
      REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM konkoure_app, konkoure_worker
    `)
    this.schema.raw(`
      REVOKE ALL ON ALL TABLES IN SCHEMA public FROM konkoure_app, konkoure_worker
    `)
  }
}
