import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * History of a candidate (docs/backend/02 §7), insert-only for the
 * application roles. Rows go with their candidate (hard delete, decision of
 * 2026-11-23) through the foreign key cascade.
 */
export default class extends BaseSchema {
  protected tableName = 'candidate_events'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('candidate_id')
        .notNullable()
        .references('id')
        .inTable('candidates')
        .onDelete('CASCADE')
      t.uuid('actor_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.specificType('type', 'candidate_event_type').notNullable()
      t.jsonb('payload').notNullable().defaultTo('{}')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['organization_id', 'candidate_id', 'created_at'])
    })

    this.schema.raw(`SELECT enable_tenant_rls('candidate_events')`)
    this.schema.raw(`REVOKE UPDATE, DELETE ON candidate_events FROM konkoure_app, konkoure_worker`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
