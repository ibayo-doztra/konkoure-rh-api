import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AuditLog from '#models/audit_log'
import { createOrganization, createUser, grantRoles } from '#tests/helpers/auth'
import { createInvitation } from '#tests/helpers/invitations'
import { sha256 } from '#shared/utils/crypto'

/** Runs `fn` as the application role; everything is rolled back afterwards. */
async function asApp(fn: (trx: TransactionClientContract) => Promise<void>) {
  const trx = await db.transaction()
  try {
    await trx.rawQuery('SET LOCAL ROLE konkoure_app')
    await fn(trx)
  } finally {
    await trx.rollback()
  }
}

const enterOrg = (trx: TransactionClientContract, id: string) =>
  trx.rawQuery(`select set_config('app.org_id', ?, true)`, [id])

/** Runs a statement expected to fail, keeping the transaction usable. */
async function denied(
  trx: TransactionClientContract,
  fn: (sp: TransactionClientContract) => unknown
) {
  const savepoint = await trx.transaction()
  try {
    await fn(savepoint)
    return null
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown'
  } finally {
    await savepoint.rollback()
  }
}

test.group('Tenant RLS (docs/backend/05 §1)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('invitations are only visible and writable inside their organization', async ({
    assert,
  }) => {
    const orgA = await createOrganization('Alpha')
    const orgB = await createOrganization('Beta')
    const { invitation } = await createInvitation(orgA)
    await createInvitation(orgB)

    await asApp(async (trx) => {
      assert.lengthOf(await trx.from('invitations'), 0, 'no tenant, no row')

      await enterOrg(trx, orgB.id)
      const visible = await trx.from('invitations')
      assert.lengthOf(visible, 1)
      assert.equal(visible[0].organization_id, orgB.id)
      assert.lengthOf(await trx.from('invitations').where('id', invitation.id), 0)

      const code = await denied(trx, (sp) =>
        sp.table('invitations').insert({
          id: '01920000-0000-7000-8000-000000000001',
          organization_id: orgA.id,
          email: 'x@konkoure.test',
          role: 'employee',
          token_hash: 'rls-test',
          expires_at: DateTime.now().plus({ days: 1 }).toSQL(),
        })
      )
      assert.equal(code, '42501')
    })
  })

  test('the token function only reveals the organization of a known token', async ({ assert }) => {
    const organization = await createOrganization('Alpha')
    const { token } = await createInvitation(organization)

    await asApp(async (trx) => {
      const lookup = async (hash: string) => {
        const result = await trx.rawQuery('select invitation_org_id_for_token(?) as id', [hash])
        return result.rows[0].id
      }
      assert.equal(await lookup(sha256(token)), organization.id)
      assert.isNull(await lookup(sha256('unknown')))
    })
  })

  test('roles are readable before a tenant is known but written inside it only', async ({
    assert,
  }) => {
    const orgA = await createOrganization('Alpha')
    const orgB = await createOrganization('Beta')
    const user = await createUser({ emailVerifiedAt: DateTime.now() })
    await grantRoles(user, orgA, ['owner'])

    await asApp(async (trx) => {
      assert.lengthOf(await trx.from('user_roles').where('user_id', user.id), 1)

      await enterOrg(trx, orgB.id)
      const code = await denied(trx, (sp) =>
        sp.table('user_roles').insert({
          id: '01920000-0000-7000-8000-000000000002',
          user_id: user.id,
          organization_id: orgA.id,
          role: 'hr_admin',
        })
      )
      assert.equal(code, '42501')
      await trx.from('user_roles').where('user_id', user.id).update({ role: 'employee' })
      const [row] = await trx.from('user_roles').where('user_id', user.id)
      assert.equal(row.role, 'owner')
    })
  })

  test('the audit journal is insert-only', async ({ assert }) => {
    const organization = await createOrganization('Alpha')
    const log = await AuditLog.create({ organizationId: organization.id, action: 'test.action' })

    await asApp(async (trx) => {
      await enterOrg(trx, organization.id)
      assert.lengthOf(await trx.from('audit_logs').where('id', log.id), 1)
      const update = await denied(trx, (sp) =>
        sp.from('audit_logs').where('id', log.id).update({ action: 'tampered' })
      )
      const remove = await denied(trx, (sp) => sp.from('audit_logs').where('id', log.id).delete())
      assert.equal(update, '42501')
      assert.equal(remove, '42501')
    })
  })
})
