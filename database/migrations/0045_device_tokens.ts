import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Kiosk device tokens (docs/backend/05 §6): scoped to `timeclock:scan` only,
 * limited in time and revocable. Only the SHA-256 of the token is stored.
 */
export default class extends BaseSchema {
  protected tableName = 'device_tokens'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.text('name').notNullable()
      t.text('token_hash').notNullable().unique()
      t.timestamp('expires_at', { useTz: true }).notNullable()
      t.timestamp('revoked_at', { useTz: true }).nullable()
      t.timestamp('last_used_at', { useTz: true }).nullable()
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['organization_id', 'created_at'])
    })
    this.schema.raw(`SELECT enable_tenant_rls('device_tokens')`)

    // The token is presented before any tenant is known (like invitations, 0114).
    this.schema.raw(`
      CREATE FUNCTION device_token_org_id(hash text) RETURNS uuid
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT organization_id FROM device_tokens
         WHERE token_hash = hash AND revoked_at IS NULL AND expires_at > now()
      $$;
    `)
    this.schema.raw('REVOKE ALL ON FUNCTION device_token_org_id(text) FROM PUBLIC')
    this.schema.raw(
      'GRANT EXECUTE ON FUNCTION device_token_org_id(text) TO konkoure_app, konkoure_worker'
    )
  }

  async down() {
    this.schema.raw('DROP FUNCTION IF EXISTS device_token_org_id(text)')
    this.schema.dropTable(this.tableName)
  }
}
