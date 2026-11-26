import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Social accounts of an organization (docs/backend/02 §10, 08 §8): a LinkedIn
 * company page or a Facebook page connected by OAuth. Tokens are encrypted
 * with `APP_KEY` and never returned by the API.
 */
export default class extends BaseSchema {
  protected tableName = 'social_accounts'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.specificType('provider', 'social_provider').notNullable()
      t.text('account_id').notNullable()
      t.text('account_name').notNullable()
      t.text('access_token_encrypted').notNullable()
      t.text('refresh_token_encrypted').nullable()
      t.timestamp('token_expires_at', { useTz: true }).nullable()
      t.specificType('scopes', 'text[]').notNullable().defaultTo('{}')
      t.specificType('status', 'social_account_status').notNullable().defaultTo('active')
      t.uuid('connected_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.jsonb('metadata').notNullable().defaultTo('{}')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.unique(['organization_id', 'provider', 'account_id'])
    })
    this.schema.raw(`CREATE TRIGGER trg_social_accounts_updated
                     BEFORE UPDATE ON social_accounts
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('social_accounts')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
