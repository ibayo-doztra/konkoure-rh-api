import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import PerformancePlan from '#models/performance_plan'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { createCycle, createGoal, createPlan } from '#tests/helpers/performance'

const ids = (response: { body(): { data: Array<{ id: string }> } }) =>
  response.body().data.map((row) => row.id)

test.group('Performance cycles', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('hr creates, updates, opens and closes a cycle', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])

    const created = await expectStatus(
      orgCall(client, 'POST', '/performance/cycles', hr, org).json({
        name: 'Annuel 2026',
        frequency: 'annual',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        selfEvalOpensAt: '2026-11-01T08:00:00Z',
        selfEvalClosesAt: '2026-11-30T18:00:00Z',
      }),
      201
    )
    const cycle = created.body().data
    assert.equal(cycle.status, 'draft')
    assert.equal(cycle.selfEvalOpensAt, '2026-11-01T08:00:00.000Z')

    const path = `/performance/cycles/${cycle.id}`
    const renamed = await expectStatus(
      orgCall(client, 'PATCH', path, hr, org).json({ name: 'Bilan 2026' }),
      200
    )
    assert.equal(renamed.body().data.name, 'Bilan 2026')

    await expectStatus(orgCall(client, 'POST', `${path}/close`, hr, org), 409)
    const opened = await expectStatus(orgCall(client, 'POST', `${path}/open`, hr, org), 200)
    assert.equal(opened.body().data.status, 'open')
    await expectStatus(orgCall(client, 'POST', `${path}/open`, hr, org), 409)
    await expectStatus(orgCall(client, 'POST', `${path}/close`, hr, org), 200)

    const frozen = await expectStatus(
      orgCall(client, 'PATCH', path, hr, org).json({ name: 'Trop tard' }),
      409
    )
    assert.equal(errorOf(frozen).details[0].rule, 'closed')

    const actions = await AuditLog.query()
      .where('organization_id', org.id)
      .where('target_id', cycle.id)
      .orderBy('created_at', 'asc')
    assert.includeMembers(
      actions.map((row) => row.action),
      ['performance_cycle.created', 'performance_cycle.opened', 'performance_cycle.closed']
    )
  })

  test('everyone reads the cycles, only owner and hr_admin write', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const employee = await hrSession(client, org, ['employee'])
    const manager = await hrSession(client, org, ['manager'])
    const mine = await createCycle(org)
    await createCycle(other)

    const list = await expectStatus(
      orgCall(client, 'GET', '/performance/cycles', employee, org),
      200
    )
    assert.deepEqual(ids(list), [mine.id])

    const body = {
      name: 'Semestre',
      frequency: 'semestrial',
      periodStart: '2026-01-01',
      periodEnd: '2026-06-30',
    }
    for (const who of [employee, manager]) {
      await expectStatus(orgCall(client, 'POST', '/performance/cycles', who, org).json(body), 403)
      await expectStatus(
        orgCall(client, 'POST', `/performance/cycles/${mine.id}/open`, who, org),
        403
      )
    }
  })

  test('a cycle of another organization is not found', async ({ client }) => {
    const org = await createHrOrganization()
    const foreign = await createCycle(await createHrOrganization('Autre'))
    const owner = await hrSession(client, org, ['owner'])
    await expectStatus(
      orgCall(client, 'PATCH', `/performance/cycles/${foreign.id}`, owner, org).json({
        name: 'x',
      }),
      404
    )
    await expectStatus(
      orgCall(client, 'POST', `/performance/cycles/${foreign.id}/open`, owner, org),
      404
    )
  })

  test('validates the cycle', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const post = (body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/performance/cycles', owner, org).json(body)

    await expectStatus(post({ name: 'x', frequency: 'weekly' }), 422)
    const reversed = await expectStatus(
      post({ name: 'x', frequency: 'custom', periodStart: '2026-06-01', periodEnd: '2026-01-01' }),
      422
    )
    assert.equal(errorOf(reversed).details[0].field, 'periodEnd')
    const selfEval = await expectStatus(
      post({
        name: 'x',
        frequency: 'custom',
        periodStart: '2026-01-01',
        periodEnd: '2026-06-01',
        selfEvalOpensAt: '2026-05-10T00:00:00Z',
        selfEvalClosesAt: '2026-05-01T00:00:00Z',
      }),
      422
    )
    assert.equal(errorOf(selfEval).details[0].field, 'selfEvalClosesAt')
  })
})

test.group('Performance plans', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('hr manages plans; everyone reads them', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const employee = await hrSession(client, org, ['employee'])

    const created = await expectStatus(
      orgCall(client, 'POST', '/performance/plans', owner, org).json({
        name: 'Plan 2026',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
      }),
      201
    )
    const plan = created.body().data
    assert.equal(plan.status, 'draft')

    const list = await expectStatus(
      orgCall(client, 'GET', '/performance/plans', employee, org),
      200
    )
    assert.deepEqual(ids(list), [plan.id])

    const path = `/performance/plans/${plan.id}`
    await expectStatus(orgCall(client, 'PATCH', path, employee, org).json({ name: 'x' }), 403)
    await expectStatus(orgCall(client, 'DELETE', path, employee, org), 403)
    const activated = await expectStatus(
      orgCall(client, 'PATCH', path, owner, org).json({ status: 'active' }),
      200
    )
    assert.equal(activated.body().data.status, 'active')

    await expectStatus(orgCall(client, 'DELETE', path, owner, org), 204)
    const row = await PerformancePlan.findOrFail(plan.id)
    assert.isNotNull(row.deletedAt)
    await expectStatus(orgCall(client, 'PATCH', path, owner, org).json({ name: 'x' }), 404)
  })

  test('refuses to activate a plan whose goals weigh more than 100', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const plan = await createPlan(org, { status: 'draft' })
    const employee = await createEmployee(org)
    await createGoal(employee, { planId: plan.id, weight: 70 })
    await createGoal(employee, { planId: plan.id, weight: 40 })
    await createGoal(employee, { planId: plan.id, weight: 50, status: 'cancelled' })

    const response = await expectStatus(
      orgCall(client, 'PATCH', `/performance/plans/${plan.id}`, owner, org).json({
        status: 'active',
      }),
      422
    )
    assert.equal(errorOf(response).code, 'E_WEIGHT_OVERFLOW')
  })

  test('a plan of another organization is not found', async ({ client }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const foreign = await createPlan(await createHrOrganization('Autre'))
    await expectStatus(
      orgCall(client, 'DELETE', `/performance/plans/${foreign.id}`, owner, org),
      404
    )
  })
})
