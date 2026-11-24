import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import SuccessionPlan from '#models/succession_plan'
import successionService from '#modules/talents/services/succession_service'
import { TenantContext } from '#shared/tenant/tenant_context'
import { createUser, grantRoles } from '#tests/helpers/auth'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { createRecruitingOrganization } from '#tests/helpers/recruitment'

test.group('/org/talents/succession', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('creates, lists, updates and deletes a plan', async ({ client, assert }) => {
    const org = await createRecruitingOrganization('Mienne')
    const owner = await hrSession(client, org, ['hr_admin'])
    const holder = await createEmployee(org, { firstName: 'Mamadou', lastName: 'Diallo' })
    const successor = await createEmployee(org, { firstName: 'Fatou', lastName: 'Camara' })

    const created = await expectStatus(
      orgCall(client, 'POST', '/talents/succession', owner, org).json({
        positionTitle: 'Directeur financier',
        currentEmployeeId: holder.id,
        successorEmployeeId: successor.id,
        readiness: '1_2_years',
      }),
      201
    )
    const plan = created.body().data
    assert.deepInclude(plan, { positionTitle: 'Directeur financier', readiness: '1_2_years' })
    assert.deepEqual(plan.currentEmployee, { id: holder.id, name: 'Mamadou Diallo' })
    assert.deepEqual(plan.successorEmployee, { id: successor.id, name: 'Fatou Camara' })

    const list = await expectStatus(
      orgCall(client, 'GET', `/talents/succession?filter[employeeId]=${successor.id}`, owner, org),
      200
    )
    assert.deepEqual(
      list.body().data.map((row: { id: string }) => row.id),
      [plan.id]
    )
    assert.equal(list.body().meta.total, 1)

    const updated = await expectStatus(
      orgCall(client, 'PATCH', `/talents/succession/${plan.id}`, owner, org).json({
        readiness: 'ready_now',
        successorEmployeeId: null,
      }),
      200
    )
    assert.deepInclude(updated.body().data, { readiness: 'ready_now', successorEmployee: null })

    await expectStatus(orgCall(client, 'DELETE', `/talents/succession/${plan.id}`, owner, org), 204)
    assert.isNull(await SuccessionPlan.find(plan.id))
    const actions = await AuditLog.query()
      .where('target_id', plan.id)
      .orderBy('created_at', 'asc')
      .select('action')
    assert.deepEqual(
      actions.map((row) => row.action),
      ['succession_plan.created', 'succession_plan.updated', 'succession_plan.deleted']
    )
  })

  test('only owner and hr_admin manage plans; the module is required', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'])
    const body = { positionTitle: 'Chef comptable' }
    await expectStatus(orgCall(client, 'GET', '/talents/succession', manager, org), 403)
    await expectStatus(orgCall(client, 'POST', '/talents/succession', manager, org).json(body), 403)
    await expectStatus(
      orgCall(client, 'POST', '/talents/succession', employee, org).json(body),
      403
    )

    const trial = await createHrOrganization('Essai')
    const owner = await hrSession(client, trial, ['owner'])
    const refused = await expectStatus(
      orgCall(client, 'POST', '/talents/succession', owner, trial).json(body),
      403
    )
    assert.equal(errorOf(refused).code, 'E_MODULE_NOT_INCLUDED')
  })

  test('validates the body and the employees', async ({ client, assert }) => {
    const org = await createRecruitingOrganization('Mienne')
    const other = await createRecruitingOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const foreign = await createEmployee(other)
    const post = (body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/talents/succession', owner, org).json(body)

    await expectStatus(post({}), 422)
    await expectStatus(post({ positionTitle: 'DAF', readiness: 'someday' }), 422)
    const unknown = await expectStatus(
      post({ positionTitle: 'DAF', successorEmployeeId: foreign.id }),
      422
    )
    assert.equal(errorOf(unknown).details[0].field, 'successorEmployeeId')
  })

  test('a plan of another organization is not found', async ({ client }) => {
    const org = await createRecruitingOrganization('Mienne')
    const other = await createRecruitingOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const foreign = await SuccessionPlan.create({
      organizationId: other.id,
      positionTitle: 'DRH',
    })

    await expectStatus(
      orgCall(client, 'PATCH', `/talents/succession/${foreign.id}`, owner, org).json({
        notes: 'x',
      }),
      404
    )
    await expectStatus(
      orgCall(client, 'DELETE', `/talents/succession/${foreign.id}`, owner, org),
      404
    )
  })

  test('works under the application role, which hides other tenants', async ({ assert }) => {
    const org = await createRecruitingOrganization('Mienne')
    const other = await createRecruitingOrganization('Autre')
    const owner = await createUser({ emailVerifiedAt: DateTime.now() })
    await grantRoles(owner, org, ['owner'])
    await SuccessionPlan.create({ organizationId: other.id, positionTitle: 'DRH' })
    const tenant = new TenantContext(org.id, ['owner'])

    await db.rawQuery('SET LOCAL ROLE konkoure_app')

    const { plan } = await successionService.create(tenant, owner, { positionTitle: 'DAF' }, {})
    const { page } = await successionService.list(tenant, { page: 1, perPage: 25 })
    assert.deepEqual(
      page.all().map((row) => row.id),
      [plan.id]
    )
  })
})
