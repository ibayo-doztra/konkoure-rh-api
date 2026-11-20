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
    plans: {
      columns: { modules: { tsType: 'string[]' }, features: { tsType: 'string[]' } },
    },
    subscriptions: {
      columns: {
        status: {
          tsType: `'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled' | 'expired'`,
        },
        cycle: { tsType: `'monthly' | 'yearly'` },
        modules_override: { tsType: 'string[] | null' },
      },
    },
    platform_admins: {
      columns: { level: { tsType: `'root' | 'support'` } },
    },
    audit_logs: {
      columns: { before_data: JSON_OBJECT, after_data: JSON_OBJECT },
    },
  },
} satisfies SchemaRules
