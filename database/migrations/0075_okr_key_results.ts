import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Key results of an OKR (docs/backend/02 §8), with the trigger that keeps
 * `okrs.progress` = round(100 × done / total) (03 §0003, 07 §5.4).
 */
export default class extends BaseSchema {
  protected tableName = 'okr_key_results'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('okr_id').notNullable().references('id').inTable('okrs').onDelete('CASCADE')
      t.smallint('position').notNullable()
      t.text('title').notNullable()
      t.text('metric').nullable()
      t.decimal('target_value', 14, 2).nullable()
      t.decimal('current_value', 14, 2).nullable()
      t.text('unit').nullable()
      t.boolean('is_done').notNullable().defaultTo(false)
      t.timestamp('done_at', { useTz: true }).nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      t.unique(['okr_id', 'position'])
      t.index(['organization_id', 'okr_id'])
    })

    this.schema.raw(`CREATE TRIGGER trg_okr_key_results_updated BEFORE UPDATE ON okr_key_results
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`
      CREATE OR REPLACE FUNCTION recompute_okr_progress() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE target uuid; total int; done int;
      BEGIN
        target := COALESCE(NEW.okr_id, OLD.okr_id);
        SELECT count(*), count(*) FILTER (WHERE is_done) INTO total, done
          FROM okr_key_results WHERE okr_id = target;
        UPDATE okrs SET progress = CASE WHEN total = 0 THEN 0
                                        ELSE round(100.0 * done / total) END,
                        updated_at = now()
         WHERE id = target;
        RETURN NULL;
      END $$
    `)
    this.schema.raw(`CREATE TRIGGER trg_okr_progress
                     AFTER INSERT OR UPDATE OF is_done OR DELETE ON okr_key_results
                     FOR EACH ROW EXECUTE FUNCTION recompute_okr_progress()`)
    this.schema.raw(`SELECT enable_tenant_rls('okr_key_results')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP FUNCTION IF EXISTS recompute_okr_progress()')
  }
}
