import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Organization of a payment from its merchant reference, for the Djomy
 * webhook settlement (07 §7.4): the caller does not know the tenant yet, and
 * RLS hides the row from the application role until it does.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE FUNCTION payment_org_id_for_reference(reference uuid) RETURNS uuid
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT organization_id FROM payments WHERE merchant_reference = reference
      $$;
    `)
    this.schema.raw('REVOKE ALL ON FUNCTION payment_org_id_for_reference(uuid) FROM PUBLIC')
    this.schema.raw(
      'GRANT EXECUTE ON FUNCTION payment_org_id_for_reference(uuid) TO konkoure_app, konkoure_worker'
    )
  }

  async down() {
    this.schema.raw('DROP FUNCTION IF EXISTS payment_org_id_for_reference(uuid)')
  }
}
