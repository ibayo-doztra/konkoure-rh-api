import { BaseSchema } from '@adonisjs/lucid/schema'

/** PostgreSQL extensions required by the schema (docs/backend/02 §13). */
export default class extends BaseSchema {
  async up() {
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS "citext"')
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS "pg_trgm"')
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS "btree_gist"')
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
  }

  async down() {
    this.schema.raw('DROP EXTENSION IF EXISTS "pgcrypto"')
    this.schema.raw('DROP EXTENSION IF EXISTS "btree_gist"')
    this.schema.raw('DROP EXTENSION IF EXISTS "pg_trgm"')
    this.schema.raw('DROP EXTENSION IF EXISTS "citext"')
  }
}
