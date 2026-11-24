import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Claim of a payment made before sign-up (07 §7.7): binds it to the new
 * organization, once. The row has no organization yet, so RLS hides it inside
 * the new tenant; the conditional update makes the token single-use even
 * under concurrent claims.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE FUNCTION claim_payment(reference uuid, token_hash text, org_id uuid)
      RETURNS uuid
      LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
        UPDATE payments
           SET organization_id = org_id, claimed_at = now()
         WHERE merchant_reference = reference
           AND claim_token_hash = token_hash
           AND organization_id IS NULL
           AND claimed_at IS NULL
           AND claim_expires_at > now()
           AND status = 'succeeded'
        RETURNING id
      $$;
    `)
    this.schema.raw('REVOKE ALL ON FUNCTION claim_payment(uuid, text, uuid) FROM PUBLIC')
    this.schema.raw(
      'GRANT EXECUTE ON FUNCTION claim_payment(uuid, text, uuid) TO konkoure_app, konkoure_worker'
    )
  }

  async down() {
    this.schema.raw('DROP FUNCTION IF EXISTS claim_payment(uuid, text, uuid)')
  }
}
