import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * n8n scoring webhook of an organization (docs/backend/02 §7, 08 §5): test and
 * production URLs, the active one, and the HMAC secret, encrypted at rest.
 */
export default class extends BaseSchema {
  protected tableName = 'recruitment_webhook_configs'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('organization_id')
        .primary()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.text('test_webhook_url').nullable()
      t.text('prod_webhook_url').nullable()
      t.text('active_env').notNullable().defaultTo('off')
      t.text('secret_encrypted').nullable()
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.raw(`ALTER TABLE recruitment_webhook_configs
                     ADD CONSTRAINT recruitment_webhook_configs_env_check
                     CHECK (active_env IN ('off', 'test', 'prod'))`)
    this.schema.raw(`CREATE TRIGGER trg_recruitment_webhook_configs_updated
                     BEFORE UPDATE ON recruitment_webhook_configs
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('recruitment_webhook_configs')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
