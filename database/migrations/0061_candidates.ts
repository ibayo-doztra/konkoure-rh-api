import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Candidates (docs/backend/02 §7, 07 §4.3). Duplicates are refused per offer
 * by e-mail or by phone (00-HANDOFF §4). Document paths stay private:
 * `documents` maps a requested key to its storage path.
 */
export default class extends BaseSchema {
  protected tableName = 'candidates'

  async up() {
    this.schema.createTable(this.tableName, (t) => {
      t.uuid('id').primary()
      t.uuid('organization_id')
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
      t.uuid('job_id').notNullable().references('id').inTable('jobs').onDelete('CASCADE')
      t.text('full_name').notNullable()
      t.specificType('email', 'citext').nullable()
      t.text('phone').nullable()
      t.specificType('stage', 'candidate_stage').notNullable().defaultTo('new')
      t.text('source').nullable()
      t.text('cv_path').nullable()
      t.text('cover_letter_path').nullable()
      t.jsonb('documents').notNullable().defaultTo('{}')
      t.text('cv_text').nullable()
      t.smallint('ai_score').nullable()
      t.text('ai_justification').nullable()
      t.jsonb('ai_strengths').notNullable().defaultTo('[]')
      t.jsonb('ai_weaknesses').notNullable().defaultTo('[]')
      t.timestamp('ai_scored_at', { useTz: true }).nullable()
      t.text('ai_candidate_name').nullable()
      t.boolean('ai_is_valid_cv').nullable()
      t.boolean('ai_fraud_alert').nullable()
      t.text('rejected_reason').nullable()
      t.uuid('hired_employee_id')
        .nullable()
        .references('id')
        .inTable('employees')
        .onDelete('SET NULL')
      t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.raw(`ALTER TABLE candidates ADD CONSTRAINT candidates_ai_score_check
                     CHECK (ai_score IS NULL OR ai_score BETWEEN 0 AND 100)`)
    this.schema.raw(`ALTER TABLE candidates ADD CONSTRAINT candidates_phone_check
                     CHECK (phone IS NULL OR phone ~ '^[0-9]{3} [0-9]{2} [0-9]{2} [0-9]{2}$')`)
    this.schema.raw(`ALTER TABLE candidates ADD CONSTRAINT candidates_source_check
                     CHECK (source IS NULL OR source IN ('careers', 'referral', 'import', 'social'))`)
    this.schema.raw(`CREATE UNIQUE INDEX candidates_job_email_uniq
                     ON candidates (job_id, lower(email::text)) WHERE email IS NOT NULL`)
    this.schema.raw(`CREATE UNIQUE INDEX candidates_job_phone_uniq
                     ON candidates (job_id, phone) WHERE phone IS NOT NULL`)
    this.schema.raw(`CREATE INDEX candidates_org_job_stage_idx
                     ON candidates (organization_id, job_id, stage)`)
    this.schema.raw(`CREATE TRIGGER trg_candidates_updated BEFORE UPDATE ON candidates
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
    this.schema.raw(`SELECT enable_tenant_rls('candidates')`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
