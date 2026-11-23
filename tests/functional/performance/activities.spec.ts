import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import GoalActivity from '#models/goal_activity'
import type Goal from '#models/goal'
import { expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { createGoal } from '#tests/helpers/performance'

const ids = (response: { body(): { data: Array<{ id: string }> } }) =>
  response.body().data.map((row) => row.id)

const activity = (goal: Goal, overrides: Partial<{ title: string; status: 'planned' | 'done' }>) =>
  GoalActivity.create({
    organizationId: goal.organizationId,
    goalId: goal.id,
    title: 'Étape',
    ...overrides,
  })

test.group('GET /org/performance/activities (added 2026-11-23)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('lists activities across the goals the caller sees', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const teamGoal = await createGoal(report.employee!)
    const ownGoal = await createGoal(manager.employee!)
    const outsiderGoal = await createGoal(await createEmployee(org))
    const deletedGoal = await createGoal(report.employee!)
    const a1 = await activity(teamGoal, { status: 'done' })
    const a2 = await activity(ownGoal, {})
    const a3 = await activity(outsiderGoal, {})
    await activity(deletedGoal, {})
    deletedGoal.deletedAt = deletedGoal.createdAt
    await deletedGoal.save()
    await activity(await createGoal(await createEmployee(other)), {})
    const get = (who: { accessToken: string }, query = '') =>
      expectStatus(orgCall(client, 'GET', `/performance/activities${query}`, who, org), 200)

    assert.sameMembers(ids(await get(owner)), [a1.id, a2.id, a3.id])
    assert.sameMembers(ids(await get(manager)), [a1.id, a2.id])
    assert.deepEqual(ids(await get(report)), [a1.id])
    assert.deepEqual(ids(await get(manager, '?filter[status]=done')), [a1.id])
    assert.deepEqual(ids(await get(owner, `?filter[goalId]=${ownGoal.id}`)), [a2.id])
    assert.deepEqual(ids(await get(owner, `?filter[employeeId]=${report.employee!.id}`)), [a1.id])
    const all = await get(owner)
    assert.equal(all.body().meta.total, 3)
  })
})

test.group('PATCH and DELETE /goals/:id/activities/:activityId (added 2026-11-23)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('completedAt follows the done status', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])
    const goal = await createGoal(employee.employee!)
    const row = await activity(goal, {})
    const path = `/performance/goals/${goal.id}/activities/${row.id}`

    const done = await expectStatus(
      orgCall(client, 'PATCH', path, employee, org).json({ status: 'done', title: 'Audit fini' }),
      200
    )
    assert.equal(done.body().data.title, 'Audit fini')
    assert.isNotNull(done.body().data.completedAt)
    const reopened = await expectStatus(
      orgCall(client, 'PATCH', path, employee, org).json({ status: 'in_progress' }),
      200
    )
    assert.isNull(reopened.body().data.completedAt)
    await expectStatus(orgCall(client, 'PATCH', path, employee, org).json({ status: 'x' }), 422)
  })

  test('same access as the goal; another goal or tenant is not found', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const report = await createEmployee(org, { managerId: manager.employee!.id })
    const colleague = await hrSession(client, org, ['employee'])
    const goal = await createGoal(report)
    const otherGoal = await createGoal(report)
    const row = await activity(goal, {})
    const path = `/performance/goals/${goal.id}/activities/${row.id}`

    await expectStatus(orgCall(client, 'PATCH', path, colleague, org).json({ title: 'x' }), 403)
    await expectStatus(orgCall(client, 'DELETE', path, colleague, org), 403)
    await expectStatus(
      orgCall(
        client,
        'DELETE',
        `/performance/goals/${otherGoal.id}/activities/${row.id}`,
        manager,
        org
      ),
      404
    )
    const foreignGoal = await createGoal(await createEmployee(await createHrOrganization('Autre')))
    const foreign = await activity(foreignGoal, {})
    await expectStatus(
      orgCall(
        client,
        'DELETE',
        `/performance/goals/${foreignGoal.id}/activities/${foreign.id}`,
        manager,
        org
      ),
      404
    )

    await expectStatus(orgCall(client, 'DELETE', path, manager, org), 204)
    assert.isNull(await GoalActivity.find(row.id))
  })
})
