import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator'

/**
 * Typing rules for the generated `database/schema.ts`: PostgreSQL enums and
 * jsonb columns would otherwise be typed `any` (forbidden, docs/backend/00 §3).
 * Enum literals must stay in sync with database/migrations/0002_enums.ts.
 */
const APP_ROLE = `'owner' | 'hr_admin' | 'manager' | 'employee' | 'recruiter' | 'security_agent'`
const JSON_OBJECT = { tsType: 'Record<string, unknown>' }
const LEAVE_TYPE = `'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'special'`
const LEAVE_STATUS = `'pending' | 'approved' | 'rejected' | 'cancelled'`

export default {
  // citext columns are reported as USER-DEFINED by the driver.
  columns: {
    email: { tsType: 'string' },
  },
  tables: {
    organizations: {
      columns: {
        performance_model: { tsType: `'classic' | 'sap'` },
        settings: JSON_OBJECT,
      },
    },
    user_roles: {
      columns: { role: { tsType: APP_ROLE } },
    },
    invitations: {
      columns: {
        role: { tsType: APP_ROLE },
        status: { tsType: `'pending' | 'accepted' | 'revoked' | 'expired'` },
      },
    },
    employees: {
      columns: {
        status: { tsType: `'active' | 'on_leave' | 'suspended' | 'terminated'` },
        address: JSON_OBJECT,
        emergency_contact: JSON_OBJECT,
        profile_details: JSON_OBJECT,
      },
    },
    contracts: {
      columns: {
        type: { tsType: `'cdi' | 'cdd' | 'stage' | 'freelance' | 'apprenticeship' | 'daily'` },
        status: { tsType: `'draft' | 'active' | 'suspended' | 'terminated'` },
      },
    },
    leave_requests: {
      columns: { type: { tsType: LEAVE_TYPE }, status: { tsType: LEAVE_STATUS } },
    },
    leave_balances: {
      columns: { leave_type: { tsType: LEAVE_TYPE } },
    },
    leave_balance_ledger: {
      columns: { leave_type: { tsType: LEAVE_TYPE } },
    },
    files: {
      columns: {
        visibility: { tsType: `'private' | 'public'` },
        category: {
          tsType: `'passport' | 'national_id' | 'diploma' | 'certificate' | 'medical' | 'other'`,
        },
      },
    },
    work_zones: {
      columns: {
        shape: { tsType: `'circle' | 'polygon'` },
        polygon: { tsType: '{ type: "Polygon"; coordinates: number[][][] }' },
      },
    },
    nfc_badge_events: {
      columns: {
        event: { tsType: `'assigned' | 'revoked' | 'reassigned' | 'scan_rejected'` },
        ip: { tsType: 'string' },
      },
    },
    time_logs: {
      columns: {
        type: { tsType: `'in' | 'out'` },
        source: { tsType: `'nfc' | 'manual' | 'mobile_gps' | 'kiosk' | 'import'` },
        anomaly: { tsType: `'out_of_zone' | 'low_accuracy' | 'clock_drift'` },
      },
    },
    attendance_days: {
      columns: { anomaly: { tsType: `'missing_out' | 'out_of_zone' | 'duplicate'` } },
    },
    jobs: {
      columns: {
        contract_type: {
          tsType: `'cdi' | 'cdd' | 'stage' | 'freelance' | 'apprenticeship' | 'daily'`,
        },
        status: { tsType: `'draft' | 'published' | 'closed' | 'archived'` },
        required_documents: {
          tsType: 'Array<{ key: string; label: string; required: boolean }>',
        },
      },
    },
    candidates: {
      columns: {
        stage: {
          tsType: `'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'`,
        },
        source: { tsType: `'careers' | 'referral' | 'import' | 'social'` },
        documents: { tsType: 'Record<string, string>' },
        ai_strengths: { tsType: 'string[]' },
        ai_weaknesses: { tsType: 'string[]' },
      },
    },
    recruitment_webhook_configs: {
      columns: { active_env: { tsType: `'off' | 'test' | 'prod'` } },
    },
    webhook_receipts: {
      columns: { payload: { tsType: 'unknown' } },
    },
    candidate_events: {
      columns: {
        type: {
          tsType: `'created' | 'stage_changed' | 'scored' | 'note_added' | 'note_deleted' | 'document_added' | 'email_sent'`,
        },
        payload: JSON_OBJECT,
      },
    },
    performance_cycles: {
      columns: {
        frequency: { tsType: `'annual' | 'semestrial' | 'quarterly' | 'custom'` },
        status: { tsType: `'draft' | 'open' | 'closed'` },
      },
    },
    performance_plans: {
      columns: { status: { tsType: `'draft' | 'active' | 'closed'` } },
    },
    goals: {
      columns: {
        category: { tsType: `'business' | 'development' | 'behavioral'` },
        status: { tsType: `'not_started' | 'in_progress' | 'achieved' | 'late' | 'cancelled'` },
      },
    },
    goal_activities: {
      columns: { status: { tsType: `'planned' | 'in_progress' | 'done'` } },
    },
    performance_reviews: {
      columns: {
        status: {
          tsType: `'not_started' | 'in_progress' | 'submitted' | 'sent_back' | 'validated' | 'signed'`,
        },
      },
    },
    feedbacks: {
      columns: { kind: { tsType: `'kudos' | 'suggestion' | 'concern'` } },
    },
    // text column with a CHECK constraint (0081), not a PostgreSQL enum.
    succession_plans: {
      columns: { readiness: { tsType: `'ready_now' | '1_2_years' | '3_plus_years'` } },
    },
    okrs: {
      columns: {
        status: { tsType: `'draft' | 'active' | 'completed' | 'archived'` },
        review_status: { tsType: `'draft' | 'pending' | 'validated' | 'needs_revision'` },
      },
    },
    plans: {
      columns: { modules: { tsType: 'string[]' }, features: { tsType: 'string[]' } },
    },
    subscriptions: {
      columns: {
        status: {
          tsType: `'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled' | 'expired'`,
        },
        cycle: { tsType: `'monthly' | 'yearly'` },
        scheduled_cycle: { tsType: `'monthly' | 'yearly'` },
        modules_override: { tsType: 'string[] | null' },
      },
    },
    payments: {
      columns: {
        cycle: { tsType: `'monthly' | 'yearly'` },
        status: {
          tsType: `'pending' | 'processing' | 'succeeded' | 'failed' | 'expired' | 'refunded'`,
        },
        method: {
          tsType: `'orange_money' | 'mtn_momo' | 'card' | 'bank_transfer' | 'manual'`,
        },
        raw_event: JSON_OBJECT,
        claim_email: { tsType: 'string' },
      },
    },
    // text column with a CHECK constraint (0094), not a PostgreSQL enum.
    usage_counters: {
      columns: { metric: { tsType: `'ai_credits' | 'active_employees' | 'sms'` } },
    },
    platform_admins: {
      columns: { level: { tsType: `'root' | 'support'` } },
    },
    notifications: {
      columns: { payload: JSON_OBJECT },
    },
    audit_logs: {
      columns: { before_data: JSON_OBJECT, after_data: JSON_OBJECT },
    },
  },
} satisfies SchemaRules
