import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Lateness on the daily aggregates (decision of 2026-11-26): `late_minutes`
 * is the delay of the first `in` after the scheduled start (0 when on time),
 * null on a day without a scheduled range. New anomaly `late`.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`ALTER TABLE attendance_days
                     ADD COLUMN late_minutes integer NULL CHECK (late_minutes >= 0)`)
    this.schema.raw(`ALTER TABLE attendance_days DROP CONSTRAINT attendance_days_anomaly_check`)
    this.schema.raw(`ALTER TABLE attendance_days ADD CONSTRAINT attendance_days_anomaly_check
                     CHECK (anomaly IS NULL OR anomaly IN ('missing_out', 'out_of_zone', 'duplicate', 'late'))`)
  }

  async down() {
    this.schema.raw(`UPDATE attendance_days SET anomaly = NULL WHERE anomaly = 'late'`)
    this.schema.raw(`ALTER TABLE attendance_days DROP CONSTRAINT attendance_days_anomaly_check`)
    this.schema.raw(`ALTER TABLE attendance_days ADD CONSTRAINT attendance_days_anomaly_check
                     CHECK (anomaly IS NULL OR anomaly IN ('missing_out', 'out_of_zone', 'duplicate'))`)
    this.schema.raw(`ALTER TABLE attendance_days DROP COLUMN late_minutes`)
  }
}
