import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Registry of stored files (docs/backend/02 §10, 08 §6). Employee documents are
 * rows with `owner_type = 'employee'` plus their `category` and `name`.
 */
export default class extends BaseSchema {
  protected tableName = 'files'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .nullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.text('bucket').notNullable()
      t.text('path').notNullable().unique()
      t.text('mime').notNullable()
      t.bigInteger('size_bytes').notNullable()
      t.text('checksum_sha256').notNullable()
      t.text('owner_type').notNullable()
      t.uuid('owner_id').nullable()
      t.text('visibility').notNullable()
      t.text('category').nullable()
      t.text('name').nullable()
      t.uuid('uploaded_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('scanned_at', { useTz: true }).nullable()
      t.text('scan_result').nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.index(['organization_id', 'owner_type', 'owner_id'])
    })

    this.schema.raw(`ALTER TABLE files ADD CONSTRAINT files_visibility_check
                     CHECK (visibility IN ('private', 'public'))`)
    this.schema.raw(`ALTER TABLE files ADD CONSTRAINT files_category_check
                     CHECK (category IS NULL OR category IN
                       ('passport', 'national_id', 'diploma', 'certificate', 'medical', 'other'))`)
    this.schema.raw(`SELECT enable_tenant_rls('files')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
