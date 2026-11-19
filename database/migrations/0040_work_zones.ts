import { BaseSchema } from '@adonisjs/lucid/schema'

/** Work zones (docs/backend/02 §5, 07 §2.1). */
export default class extends BaseSchema {
  protected tableName = 'work_zones'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.text('name').notNullable()
      t.specificType('shape', 'zone_shape').notNullable().defaultTo('circle')
      t.double('latitude').nullable()
      t.double('longitude').nullable()
      t.integer('radius_meters').nullable()
      t.jsonb('polygon').nullable()
      t.boolean('is_active').notNullable().defaultTo(true)
      t.text('timezone').nullable()
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('deleted_at', { useTz: true }).nullable()

      t.index(['organization_id', 'is_active'])
    })

    this.schema.raw(`ALTER TABLE work_zones ADD CONSTRAINT work_zones_radius_check
                     CHECK (radius_meters IS NULL OR radius_meters BETWEEN 20 AND 5000)`)
    this.schema.raw(`ALTER TABLE work_zones ADD CONSTRAINT work_zones_shape_check CHECK (
                       (shape = 'circle' AND latitude IS NOT NULL AND longitude IS NOT NULL
                          AND radius_meters IS NOT NULL)
                       OR (shape = 'polygon' AND polygon IS NOT NULL))`)
    this.schema.raw(`CREATE TRIGGER trg_work_zones_updated BEFORE UPDATE ON work_zones
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('work_zones')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
