import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Monthly partitions of the 12 months to come (docs/backend/03 §2, 09 §4), for
 * `time_logs` and `audit_logs`; `partitions:ensure` then keeps a 3-month lead.
 * A month whose rows already sit in the DEFAULT partition cannot be attached
 * as is: those rows are moved out first, then back into the new partition, in
 * the migration's transaction. Older rows stay in DEFAULT.
 */
const TABLES: Array<[table: string, column: string]> = [
  ['time_logs', 'punched_at'],
  ['audit_logs', 'created_at'],
]

export default class extends BaseSchema {
  async up() {
    for (const [table, column] of TABLES) {
      this.schema.raw(`
        DO $$
        DECLARE
          month date := date_trunc('month', now())::date;
          lower_bound date;
          upper_bound date;
          part text;
        BEGIN
          FOR step IN 0..11 LOOP
            lower_bound := month + make_interval(months => step);
            upper_bound := month + make_interval(months => step + 1);
            part := '${table}_' || to_char(lower_bound, 'YYYY_MM');
            CONTINUE WHEN to_regclass(part) IS NOT NULL;
            EXECUTE format(
              'CREATE TEMP TABLE partition_move ON COMMIT DROP AS
                 SELECT * FROM ${table}_default WHERE ${column} >= %L AND ${column} < %L',
              lower_bound, upper_bound
            );
            EXECUTE format(
              'DELETE FROM ${table}_default WHERE ${column} >= %L AND ${column} < %L',
              lower_bound, upper_bound
            );
            EXECUTE format(
              'CREATE TABLE %I PARTITION OF ${table} FOR VALUES FROM (%L) TO (%L)',
              part, lower_bound, upper_bound
            );
            EXECUTE 'INSERT INTO ${table} SELECT * FROM partition_move';
            DROP TABLE partition_move;
          END LOOP;
        END $$;
      `)
    }
  }

  /** Partitions are data containers: they stay (dropping one would lose its rows). */
  async down() {}
}
