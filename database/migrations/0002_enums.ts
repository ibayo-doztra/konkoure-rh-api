import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Every PostgreSQL enum of the schema (docs/backend/02 §2), created once up front.
 *
 * `performance_model` uses ('classic','sap'): 00-HANDOFF §4 and 02 « Compléments »
 * make `sap` the default model, which the ('classic','okr') list of 02 §2 lacks.
 */
const ENUMS: Record<string, string[]> = {
  app_role: ['owner', 'hr_admin', 'manager', 'employee', 'recruiter', 'security_agent'],
  platform_admin_level: ['root', 'support'],
  employee_status: ['active', 'on_leave', 'suspended', 'terminated'],
  contract_type: ['cdi', 'cdd', 'stage', 'freelance', 'apprenticeship', 'daily'],
  contract_status: ['draft', 'active', 'suspended', 'terminated'],
  punch_type: ['in', 'out'],
  punch_source: ['nfc', 'manual', 'mobile_gps', 'kiosk', 'import'],
  zone_shape: ['circle', 'polygon'],
  leave_type: ['annual', 'sick', 'maternity', 'paternity', 'unpaid', 'special'],
  leave_status: ['pending', 'approved', 'rejected', 'cancelled'],
  job_status: ['draft', 'published', 'closed', 'archived'],
  candidate_stage: ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'],
  candidate_event_type: [
    'created',
    'stage_changed',
    'scored',
    'note_added',
    'note_deleted',
    'document_added',
    'email_sent',
  ],
  performance_model: ['classic', 'sap'],
  goal_category: ['business', 'development', 'behavioral'],
  goal_status: ['not_started', 'in_progress', 'achieved', 'late', 'cancelled'],
  goal_activity_status: ['planned', 'in_progress', 'done'],
  okr_status: ['draft', 'active', 'completed', 'archived'],
  okr_review_status: ['draft', 'pending', 'validated', 'needs_revision'],
  perf_cycle_frequency: ['annual', 'semestrial', 'quarterly', 'custom'],
  perf_cycle_status: ['draft', 'open', 'closed'],
  perf_plan_status: ['draft', 'active', 'closed'],
  perf_review_status: [
    'not_started',
    'in_progress',
    'submitted',
    'sent_back',
    'validated',
    'signed',
  ],
  feedback_kind: ['kudos', 'suggestion', 'concern'],
  subscription_status: ['trialing', 'active', 'past_due', 'suspended', 'canceled', 'expired'],
  billing_cycle: ['monthly', 'yearly'],
  payment_status: ['pending', 'processing', 'succeeded', 'failed', 'expired', 'refunded'],
  payment_method: ['orange_money', 'mtn_momo', 'card', 'bank_transfer', 'manual'],
  social_provider: ['facebook', 'linkedin', 'twitter'],
  social_account_status: ['active', 'expired', 'revoked'],
  social_post_status: ['pending', 'published', 'failed'],
  invitation_status: ['pending', 'accepted', 'revoked', 'expired'],
  demo_request_status: ['new', 'contacted', 'scheduled', 'done', 'rejected'],
  email_delivery_status: ['pending', 'sent', 'failed'],
}

export default class extends BaseSchema {
  async up() {
    for (const [name, values] of Object.entries(ENUMS)) {
      const list = values.map((value) => `'${value}'`).join(', ')
      this.schema.raw(`CREATE TYPE ${name} AS ENUM (${list})`)
    }
  }

  async down() {
    for (const name of Object.keys(ENUMS).reverse()) {
      this.schema.raw(`DROP TYPE IF EXISTS ${name}`)
    }
  }
}
