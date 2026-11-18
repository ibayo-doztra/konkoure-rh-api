import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Application roles and row-level security helpers (docs/backend/03 §8, 05 §1).
 * Roles are cluster-wide, hence created only when missing and never dropped: if
 * the migrator lacks CREATEROLE/BYPASSRLS, create them beforehand. Each tenant
 * table migration then calls `SELECT enable_tenant_rls('<table>')`.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'konkoure_app') THEN
          CREATE ROLE konkoure_app LOGIN NOSUPERUSER NOBYPASSRLS;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'konkoure_worker') THEN
          CREATE ROLE konkoure_worker LOGIN NOSUPERUSER BYPASSRLS;
        END IF;
      END $$;
    `)
    this.schema.raw('GRANT USAGE ON SCHEMA public TO konkoure_app, konkoure_worker')
    this.schema.raw(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO konkoure_app, konkoure_worker
    `)

    this.schema.raw(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO konkoure_app, konkoure_worker
    `)

    // Empty outside a tenant transaction: `set_config(..., true)` resets to ''.
    this.schema.raw(`
      CREATE FUNCTION current_org_id() RETURNS uuid
      LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('app.org_id', true), '')::uuid
      $$;
    `)
    this.schema.raw(`
      CREATE FUNCTION enable_tenant_rls(target regclass) RETURNS void
      LANGUAGE plpgsql AS $$
      BEGIN
        EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target);
        EXECUTE format(
          'CREATE POLICY tenant_isolation ON %s TO konkoure_app
             USING (organization_id = current_org_id())
             WITH CHECK (organization_id = current_org_id())',
          target
        );
      END $$;
    `)
  }

  async down() {
    this.schema.raw('DROP FUNCTION IF EXISTS enable_tenant_rls(regclass)')
    this.schema.raw('DROP FUNCTION IF EXISTS current_org_id()')
    this.schema.raw(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM konkoure_app, konkoure_worker
    `)
    this.schema.raw(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE USAGE, SELECT ON SEQUENCES FROM konkoure_app, konkoure_worker
    `)
    this.schema.raw('REVOKE USAGE ON SCHEMA public FROM konkoure_app, konkoure_worker')
  }
}
