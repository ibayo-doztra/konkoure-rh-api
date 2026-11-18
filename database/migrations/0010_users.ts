import { BaseSchema } from '@adonisjs/lucid/schema'

/** Global accounts, linked to organizations through user_roles (docs/backend/02 §3). */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.specificType('email', 'citext').notNullable()
      t.text('password_hash').nullable()
      t.text('full_name').nullable()
      t.text('avatar_url').nullable()
      t.text('preferred_language').notNullable().defaultTo('fr')
      t.timestamp('email_verified_at', { useTz: true }).nullable()
      t.timestamp('last_login_at', { useTz: true }).nullable()
      t.integer('failed_login_attempts').notNullable().defaultTo(0)
      t.timestamp('locked_until', { useTz: true }).nullable()
      // Legacy accounts imported without a usable hash (docs/backend/04 §7).
      t.boolean('must_reset_password').notNullable().defaultTo(false)
      t.boolean('is_active').notNullable().defaultTo(true)
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()
    })

    this.schema.raw(`ALTER TABLE users ADD CONSTRAINT users_preferred_language_check
                     CHECK (preferred_language IN ('fr', 'en'))`)
    this.schema.raw(`CREATE UNIQUE INDEX users_email_uniq ON users (email)
                     WHERE deleted_at IS NULL`)
    this.schema.raw(`CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
