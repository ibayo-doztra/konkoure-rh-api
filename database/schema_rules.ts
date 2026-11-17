import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator'

/**
 * Typing rules for the generated `database/schema.ts`: PostgreSQL enums and
 * jsonb columns would otherwise be typed `any` (forbidden, docs/backend/00 §3).
 * Enum literals must stay in sync with database/migrations/0002_enums.ts.
 */
const APP_ROLE = `'owner' | 'hr_admin' | 'manager' | 'employee' | 'recruiter' | 'security_agent'`
const JSON_OBJECT = { tsType: 'Record<string, unknown>' }

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
    platform_admins: {
      columns: { level: { tsType: `'root' | 'support'` } },
    },
    audit_logs: {
      columns: { before_data: JSON_OBJECT, after_data: JSON_OBJECT },
    },
  },
} satisfies SchemaRules
