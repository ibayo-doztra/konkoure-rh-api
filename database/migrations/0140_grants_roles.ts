import { BaseSchema } from '@adonisjs/lucid/schema'

/** Insert-only for both application roles (03 §8, 05 §7). */
const APPEND_ONLY = [
  'audit_logs',
  'audit_logs_default',
  'usage_events',
  'candidate_events',
  'leave_balance_ledger',
  'nfc_badge_events',
]

/**
 * Hidden from `konkoure_readonly`: accounts and credentials (03 §8), plus the
 * tables holding tokens, secrets or signed payloads (decision of 2026-11-26).
 */
const HIDDEN_FROM_READONLY = [
  'users',
  'auth_access_tokens',
  'auth_refresh_tokens',
  'social_accounts',
  'payments',
  'password_reset_tokens',
  'invitations',
  'device_tokens',
  'platform_settings',
  'webhook_receipts',
]

/**
 * Application SQL roles, last step (docs/backend/03 §8, decisions of 2026-11-26):
 *
 * - `konkoure_readonly`: BI and support, reads every organization (BYPASSRLS),
 *   tables to come included, except the hidden ones above. Created only when
 *   missing, like the roles of 0004 (create it beforehand if the migrator lacks
 *   the rights).
 * - Insert-only tables: revoked again for both roles, whatever an earlier
 *   blanket grant gave back.
 * - `purge_append_only_rows(org)`: the organization purge (30 days after the
 *   deletion) removes the rows of the insert-only tables through this definer
 *   function, which refuses any organization not due for the purge.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'konkoure_readonly') THEN
          CREATE ROLE konkoure_readonly LOGIN NOSUPERUSER BYPASSRLS;
        END IF;
      END $$;
    `)
    this.schema.raw('GRANT USAGE ON SCHEMA public TO konkoure_readonly')
    this.schema.raw('GRANT SELECT ON ALL TABLES IN SCHEMA public TO konkoure_readonly')
    this.schema.raw(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO konkoure_readonly'
    )
    this.schema.raw(`REVOKE SELECT ON ${HIDDEN_FROM_READONLY.join(', ')} FROM konkoure_readonly`)

    this.schema.raw(
      `REVOKE UPDATE, DELETE ON ${APPEND_ONLY.join(', ')} FROM konkoure_app, konkoure_worker`
    )

    this.schema.raw(`
      CREATE FUNCTION purge_append_only_rows(target uuid) RETURNS jsonb
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      DECLARE
        counts jsonb := '{}'::jsonb;
        removed integer;
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM organizations
           WHERE id = target AND purged_at IS NULL
             AND deleted_at < now() - interval '30 days'
        ) THEN
          RAISE EXCEPTION 'organization % is not due for purge', target;
        END IF;
        DELETE FROM candidate_events WHERE organization_id = target;
        GET DIAGNOSTICS removed = ROW_COUNT;
        counts := counts || jsonb_build_object('candidate_events', removed);
        DELETE FROM nfc_badge_events WHERE organization_id = target;
        GET DIAGNOSTICS removed = ROW_COUNT;
        counts := counts || jsonb_build_object('nfc_badge_events', removed);
        DELETE FROM leave_balance_ledger WHERE organization_id = target;
        GET DIAGNOSTICS removed = ROW_COUNT;
        counts := counts || jsonb_build_object('leave_balance_ledger', removed);
        DELETE FROM usage_events WHERE organization_id = target;
        GET DIAGNOSTICS removed = ROW_COUNT;
        counts := counts || jsonb_build_object('usage_events', removed);
        RETURN counts;
      END $$;
    `)
    this.schema.raw('REVOKE ALL ON FUNCTION purge_append_only_rows(uuid) FROM PUBLIC')
    this.schema.raw('GRANT EXECUTE ON FUNCTION purge_append_only_rows(uuid) TO konkoure_worker')
  }

  async down() {
    this.schema.raw('DROP FUNCTION IF EXISTS purge_append_only_rows(uuid)')
    this.schema.raw(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM konkoure_readonly'
    )
    this.schema.raw('REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM konkoure_readonly')
    this.schema.raw('REVOKE USAGE ON SCHEMA public FROM konkoure_readonly')
  }
}
