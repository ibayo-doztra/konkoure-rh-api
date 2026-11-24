import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `scoring_skipped`: the AI scoring of an application did not run because the
 * monthly AI credits are exhausted (decision of 2026-11-24). Enum values
 * cannot be removed: `down` leaves it in place.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`ALTER TYPE candidate_event_type ADD VALUE IF NOT EXISTS 'scoring_skipped'`)
  }

  async down() {}
}
