import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import cycleService from '#modules/performance/services/cycle_service'
import planService from '#modules/performance/services/plan_service'
import goalService from '#modules/performance/services/goal_service'
import okrService from '#modules/performance/services/okr_service'
import { TenantContext } from '#shared/tenant/tenant_context'
import { createUser, grantRoles } from '#tests/helpers/auth'
import { createEmployee, createHrOrganization } from '#tests/helpers/hr'
import { createGoal } from '#tests/helpers/performance'

test.group('Performance services under the application role', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('mutations work with RLS enforced, which hides other tenants', async ({ assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await createUser({ emailVerifiedAt: DateTime.now() })
    await grantRoles(owner, org, ['owner'])
    const employee = await createEmployee(org)
    const foreign = await createGoal(await createEmployee(other))
    const tenant = new TenantContext(org.id, ['owner'])

    // Lasts until the global transaction rolls back at the end of the test.
    await db.rawQuery('SET LOCAL ROLE konkoure_app')

    const cycle = await cycleService.create(
      tenant,
      owner,
      {
        name: 'Annuel',
        frequency: 'annual',
        periodStart: DateTime.fromISO('2026-01-01'),
        periodEnd: DateTime.fromISO('2026-12-31'),
      },
      {}
    )
    await cycleService.open(tenant, owner, cycle.id, {})
    const plan = await planService.create(
      tenant,
      owner,
      {
        name: 'Plan',
        periodStart: DateTime.fromISO('2026-01-01'),
        periodEnd: DateTime.fromISO('2026-12-31'),
        status: 'active',
      },
      {}
    )
    const goal = await goalService.create(
      tenant,
      owner,
      employee.id,
      { title: 'Objectif', planId: plan.id, weight: 50 },
      {}
    )
    await goalService.progress(tenant, owner, goal.id, 100, {})
    await goalService.addActivity(tenant, owner, goal.id, { title: 'Étape' }, {})
    await goalService.markLate()

    const { rows } = await goalService.list(tenant, {})
    assert.deepEqual(
      rows.map((row) => row.id),
      [goal.id]
    )
    await assert.rejects(() => goalService.find(tenant, foreign.id), 'E_NOT_FOUND')
  })
})

test.group('OKR services under the application role', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the lifecycle and the progress trigger work with RLS enforced', async ({ assert }) => {
    const org = await createHrOrganization('Mienne')
    const owner = await createUser({ emailVerifiedAt: DateTime.now() })
    const holder = await createUser({ emailVerifiedAt: DateTime.now() })
    await grantRoles(owner, org, ['owner'])
    await grantRoles(holder, org, ['employee'])
    const employee = await createEmployee(org, { userId: holder.id })
    const hr = new TenantContext(org.id, ['owner'])
    const self = new TenantContext(org.id, ['employee'], employee.id)

    await db.rawQuery('SET LOCAL ROLE konkoure_app')

    const { okr } = await okrService.create(
      self,
      holder,
      employee.id,
      { quarter: '2026-Q3', objective: 'Objectif' },
      {}
    )
    const { keyResults } = await okrService.replaceKeyResults(
      self,
      holder,
      okr.id,
      [{ title: 'A', isDone: true }, { title: 'B' }],
      {}
    )
    await okrService.submit(self, holder, okr.id, {})
    const validated = await okrService.validate(hr, owner, okr.id, undefined, {})
    assert.equal(validated.okr.progress, 50)
    const done = await okrService.updateKeyResult(
      self,
      holder,
      okr.id,
      keyResults[1].id,
      { isDone: true },
      {}
    )
    assert.equal(done.okr.progress, 100)
    await okrService.addCheckin(self, holder, okr.id, 'Point', {})
    const { rows } = await okrService.list(self, {})
    assert.lengthOf(rows, 1)
  })
})
