import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Shared SQL functions (docs/backend/03 §2). The OKR progress function and its
 * trigger are created by the okr_key_results migration (0075), with that table.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
    `)
  }

  async down() {
    this.schema.raw('DROP FUNCTION IF EXISTS set_updated_at()')
  }
}
