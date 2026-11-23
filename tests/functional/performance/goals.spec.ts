import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import Goal from '#models/goal'
import goalService from '#modules/performance/services/goal_service'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { createGoal, createPlan } from '#tests/helpers/performance'

const ids = (response: { body(): { data: Array<{ id: string }> } }) =>
  response.body().data.map((row) => row.id)

test.group('GET /org/performance/goals', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('scopes goals by role and organization', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const own = await createGoal(manager.employee!)
    const team = await createGoal(report.employee!)
    const unrelated = await createGoal(await createEmployee(org))
    const foreign = await createGoal(await createEmployee(other))
    const get = (who: { accessToken: string }, query = '') =>
      expectStatus(orgCall(client, 'GET', `/performance/goals${query}`, who, org), 200)

    const all = await get(owner)
    assert.sameMembers(ids(all), [own.id, team.id, unrelated.id])
    assert.notInclude(ids(all), foreign.id)
    assert.sameMembers(ids(await get(manager)), [own.id, team.id])
    assert.deepEqual(ids(await get(report)), [team.id])
    assert.deepEqual(ids(await get(owner, `?filter[employeeId]=${report.employee!.id}`)), [team.id])
    await expectStatus(
      orgCall(client, 'GET', '/performance/goals?filter[status]=done', owner, org),
      422
    )
  })
})

test.group('POST /org/performance/goals', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('an employee creates a goal for themselves', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])
    const response = await expectStatus(
      orgCall(client, 'POST', '/performance/goals', employee, org).json({
        title: 'Certification paie',
        category: 'development',
        dueDate: '2026-12-31',
      }),
      201
    )
    const goal = response.body().data
    assert.equal(goal.employeeId, employee.employee!.id)
    assert.equal(goal.status, 'not_started')
    assert.equal(goal.category, 'development')
  })

  test('only owner, hr_admin and the manager set another holder or an owner', async ({
    client,
  }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const outsider = await createEmployee(org)
    const post = (who: { accessToken: string }, body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/performance/goals', who, org).json({ title: 'Objectif', ...body })

    await expectStatus(post(report, { employeeId: outsider.id }), 403)
    await expectStatus(post(report, { ownerId: manager.employee!.id }), 403)
    await expectStatus(post(manager, { employeeId: outsider.id }), 403)
    await expectStatus(post(manager, { employeeId: report.employee!.id }), 201)
    await expectStatus(
      post(manager, { employeeId: report.employee!.id, ownerId: manager.employee!.id }),
      201
    )
    await expectStatus(post(hr, { employeeId: outsider.id, ownerId: report.employee!.id }), 201)
  })

  test('a holder is required and must belong to the organization', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const unlinked = await hrSession(client, org, ['owner'], { linked: false })
    const foreign = await createEmployee(await createHrOrganization('Autre'))

    const missing = await expectStatus(
      orgCall(client, 'POST', '/performance/goals', unlinked, org).json({ title: 'x' }),
      422
    )
    assert.equal(errorOf(missing).details[0].field, 'employeeId')
    await expectStatus(
      orgCall(client, 'POST', '/performance/goals', unlinked, org).json({
        title: 'x',
        employeeId: foreign.id,
      }),
      422
    )
  })

  test('refuses weights above 100 on an active plan only', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])
    const active = await createPlan(org)
    const draft = await createPlan(org, { status: 'draft' })
    await createGoal(employee.employee!, { planId: active.id, weight: 60 })
    await createGoal(employee.employee!, { planId: active.id, weight: 30, status: 'cancelled' })
    const post = (planId: string, weight: number) =>
      orgCall(client, 'POST', '/performance/goals', employee, org).json({
        title: 'Objectif',
        planId,
        weight,
      })

    await expectStatus(post(active.id, 40), 201)
    const refused = await expectStatus(post(active.id, 1), 422)
    assert.equal(errorOf(refused).code, 'E_WEIGHT_OVERFLOW')
    await expectStatus(post(draft.id, 100), 201)
    await expectStatus(post(draft.id, 100), 201)

    const foreignPlan = await createPlan(await createHrOrganization('Autre'))
    const unknown = await expectStatus(post(foreignPlan.id, 10), 422)
    assert.equal(errorOf(unknown).details[0].field, 'planId')
  })

  test('validates the goal', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])
    const post = (body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/performance/goals', employee, org).json(body)

    await expectStatus(post({}), 422)
    await expectStatus(post({ title: 'x', weight: 101 }), 422)
    await expectStatus(post({ title: 'x', category: 'personal' }), 422)
    const dates = await expectStatus(
      post({ title: 'x', startDate: '2026-06-01', dueDate: '2026-01-01' }),
      422
    )
    assert.equal(errorOf(dates).details[0].field, 'dueDate')
  })
})

test.group('Goal detail, update and deletion', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('holder, team manager and hr access a goal; others do not', async ({ client }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const colleague = await hrSession(client, org, ['employee'])
    const otherManager = await hrSession(client, org, ['manager'])
    const goal = await createGoal(report.employee!)
    const path = `/performance/goals/${goal.id}`

    for (const who of [hr, manager, report]) {
      await expectStatus(orgCall(client, 'GET', path, who, org), 200)
    }
    for (const who of [colleague, otherManager]) {
      await expectStatus(orgCall(client, 'GET', path, who, org), 403)
      await expectStatus(orgCall(client, 'PATCH', path, who, org).json({ title: 'x' }), 403)
      await expectStatus(orgCall(client, 'DELETE', path, who, org), 403)
    }
  })

  test('a goal of another organization is not found', async ({ client }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const foreign = await createGoal(await createEmployee(await createHrOrganization('Autre')))
    const path = `/performance/goals/${foreign.id}`
    await expectStatus(orgCall(client, 'GET', path, owner, org), 404)
    await expectStatus(orgCall(client, 'PATCH', path, owner, org).json({ title: 'x' }), 404)
    await expectStatus(
      orgCall(client, 'PATCH', `${path}/progress`, owner, org).json({ progress: 10 }),
      404
    )
    await expectStatus(orgCall(client, 'GET', `${path}/activities`, owner, org), 404)
  })

  test('the holder updates their goal but cannot pick its owner', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])
    const goal = await createGoal(employee.employee!)
    const path = `/performance/goals/${goal.id}`

    const updated = await expectStatus(
      orgCall(client, 'PATCH', path, employee, org).json({
        title: 'Nouveau titre',
        measurement: 'Délai moyen en jours',
        status: 'cancelled',
      }),
      200
    )
    assert.equal(updated.body().data.title, 'Nouveau titre')
    assert.equal(updated.body().data.status, 'cancelled')
    await expectStatus(
      orgCall(client, 'PATCH', path, employee, org).json({ ownerId: employee.employee!.id }),
      403
    )
    await expectStatus(orgCall(client, 'PATCH', path, employee, org).json({ status: 'late' }), 422)
  })

  test('moving a goal into an active plan checks the weights', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const employee = await createEmployee(org)
    const plan = await createPlan(org)
    await createGoal(employee, { planId: plan.id, weight: 80 })
    const goal = await createGoal(employee, { weight: 30 })

    const response = await expectStatus(
      orgCall(client, 'PATCH', `/performance/goals/${goal.id}`, owner, org).json({
        planId: plan.id,
      }),
      422
    )
    assert.equal(errorOf(response).code, 'E_WEIGHT_OVERFLOW')
    await expectStatus(
      orgCall(client, 'PATCH', `/performance/goals/${goal.id}`, owner, org).json({
        planId: plan.id,
        weight: 20,
      }),
      200
    )
  })

  test('refuses a parent goal that creates a loop', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const employee = await createEmployee(org)
    const parent = await createGoal(employee)
    const child = await createGoal(employee, { parentGoalId: parent.id })

    const response = await expectStatus(
      orgCall(client, 'PATCH', `/performance/goals/${parent.id}`, owner, org).json({
        parentGoalId: child.id,
      }),
      422
    )
    assert.equal(errorOf(response).details[0].rule, 'cycle')
  })

  test('deletion is soft and hides the goal', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const report = await createEmployee(org, { managerId: manager.employee!.id })
    const goal = await createGoal(report)
    const path = `/performance/goals/${goal.id}`

    await expectStatus(orgCall(client, 'DELETE', path, manager, org), 204)
    const row = await Goal.findOrFail(goal.id)
    assert.isNotNull(row.deletedAt)
    await expectStatus(orgCall(client, 'GET', path, manager, org), 404)
  })
})

test.group('PATCH /org/performance/goals/:id/progress', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('100 % achieves the goal, less reopens it', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])
    const goal = await createGoal(employee.employee!)
    const patch = (progress: number) =>
      expectStatus(
        orgCall(client, 'PATCH', `/performance/goals/${goal.id}/progress`, employee, org).json({
          progress,
        }),
        200
      )

    const started = await patch(40)
    assert.equal(started.body().data.status, 'in_progress')
    const done = await patch(100)
    assert.equal(done.body().data.status, 'achieved')
    assert.equal(done.body().data.progress, 100)
    const reopened = await patch(80)
    assert.equal(reopened.body().data.status, 'in_progress')
  })

  test('the holder and their manager only; never a cancelled goal', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await createEmployee(org, { managerId: manager.employee!.id })
    const goal = await createGoal(report)
    const cancelled = await createGoal(report, { status: 'cancelled' })
    const patch = (who: { accessToken: string }, id: string, progress: unknown) =>
      orgCall(client, 'PATCH', `/performance/goals/${id}/progress`, who, org).json({ progress })

    await expectStatus(patch(hr, goal.id, 10), 403)
    await expectStatus(patch(manager, goal.id, 10), 200)
    await expectStatus(patch(manager, goal.id, 150), 422)
    const refused = await expectStatus(patch(manager, cancelled.id, 10), 409)
    assert.equal(errorOf(refused).details[0].rule, 'cancelled')
  })
})

test.group('Goal activities', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('the holder adds and lists activities', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])
    const colleague = await hrSession(client, org, ['employee'])
    const goal = await createGoal(employee.employee!)
    const path = `/performance/goals/${goal.id}/activities`

    const planned = await expectStatus(
      orgCall(client, 'POST', path, employee, org).json({
        title: 'Former l’équipe',
        plannedDate: '2026-04-01',
      }),
      201
    )
    assert.equal(planned.body().data.status, 'planned')
    assert.isNull(planned.body().data.completedAt)
    const done = await expectStatus(
      orgCall(client, 'POST', path, employee, org).json({ title: 'Audit', status: 'done' }),
      201
    )
    assert.isNotNull(done.body().data.completedAt)

    const list = await expectStatus(orgCall(client, 'GET', path, employee, org), 200)
    assert.deepEqual(ids(list), [planned.body().data.id, done.body().data.id])
    await expectStatus(orgCall(client, 'GET', path, colleague, org), 403)
    await expectStatus(orgCall(client, 'POST', path, colleague, org).json({ title: 'x' }), 403)
    await expectStatus(orgCall(client, 'POST', path, employee, org).json({ title: '' }), 422)
  })
})

test.group('goals:mark-late', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('marks open goals past their due date as late', async ({ assert }) => {
    const org = await createHrOrganization()
    const employee = await createEmployee(org)
    const at = DateTime.fromISO('2026-06-15T10:00:00Z')
    const past = DateTime.fromISO('2026-06-14')
    const overdue = await createGoal(employee, { dueDate: past, status: 'in_progress' })
    const untouched = await createGoal(employee, { dueDate: past, status: 'not_started' })
    const achieved = await createGoal(employee, {
      dueDate: past,
      status: 'achieved',
      progress: 100,
    })
    const cancelled = await createGoal(employee, { dueDate: past, status: 'cancelled' })
    const dueToday = await createGoal(employee, { dueDate: DateTime.fromISO('2026-06-15') })

    await goalService.markLate(at)

    const status = async (goal: Goal) => {
      const row = await Goal.findOrFail(goal.id)
      return row.status
    }
    assert.equal(await status(overdue), 'late')
    assert.equal(await status(untouched), 'late')
    assert.equal(await status(achieved), 'achieved')
    assert.equal(await status(cancelled), 'cancelled')
    assert.equal(await status(dueToday), 'not_started')
  })
})
