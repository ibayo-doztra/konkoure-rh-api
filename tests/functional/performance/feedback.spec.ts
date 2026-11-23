import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import Achievement from '#models/achievement'
import type Employee from '#models/employee'
import Feedback, { type FeedbackKind } from '#models/feedback'
import Notification from '#models/notification'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { createGoal } from '#tests/helpers/performance'

const notificationsOf = (organizationId: string, type: string) =>
  Notification.query().where('organization_id', organizationId).where('type', type)

const ids = (response: { body(): { data: Array<{ id: string }> } }) =>
  response.body().data.map((row) => row.id)

function feedback(
  from: Employee | null,
  to: Employee,
  overrides: Partial<{ kind: FeedbackKind; isPrivate: boolean; visibleToManager: boolean }> = {}
) {
  return Feedback.create({
    organizationId: to.organizationId,
    fromEmployeeId: from?.id ?? null,
    toEmployeeId: to.id,
    kind: 'kudos',
    message: 'Merci pour ton aide',
    ...overrides,
  })
}

test.group('POST /org/performance/feedback', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('anyone gives feedback; the recipient is notified', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const author = await hrSession(client, org, ['employee'])
    const recipient = await hrSession(client, org, ['employee'])

    const response = await expectStatus(
      orgCall(client, 'POST', '/performance/feedback', author, org).json({
        toEmployeeId: recipient.employee!.id,
        kind: 'kudos',
        message: 'Superbe présentation',
      }),
      201
    )
    const body = response.body().data
    assert.equal(body.fromEmployeeId, author.employee!.id)
    assert.isFalse(body.isPrivate)
    assert.isTrue(body.visibleToManager)
    const [notice] = await notificationsOf(org.id, 'feedback.received')
    assert.equal(notice.userId, recipient.user.id)
  })

  test('a concern also alerts HR', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const author = await hrSession(client, org, ['employee'])
    const recipient = await hrSession(client, org, ['employee'])

    await expectStatus(
      orgCall(client, 'POST', '/performance/feedback', author, org).json({
        toEmployeeId: recipient.employee!.id,
        kind: 'concern',
        message: 'Retards répétés aux réunions',
        isPrivate: true,
      }),
      201
    )
    const notices = await notificationsOf(org.id, 'feedback.received')
    assert.sameMembers(
      notices.map((row) => row.userId),
      [recipient.user.id, hr.user.id]
    )
  })

  test('validates the recipient, the kind and the links', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const author = await hrSession(client, org, ['employee'])
    const other = await createEmployee(org)
    const foreign = await createEmployee(await createHrOrganization('Autre'))
    const post = (body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/performance/feedback', author, org).json({
        kind: 'kudos',
        message: 'Bravo',
        ...body,
      })

    await expectStatus(post({ toEmployeeId: foreign.id }), 422)
    const self = await expectStatus(post({ toEmployeeId: author.employee!.id }), 422)
    assert.equal(errorOf(self).details[0].rule, 'self')
    await expectStatus(post({ toEmployeeId: other.id, kind: 'praise' }), 422)
    await expectStatus(post({ toEmployeeId: other.id, message: '' }), 422)
    const foreignGoal = await createGoal(foreign)
    await expectStatus(post({ toEmployeeId: other.id, goalId: foreignGoal.id }), 422)
  })
})

test.group('GET /org/performance/feedback', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('received and sent; the team when visible to managers; HR everything', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const colleague = await hrSession(client, org, ['employee'])
    const outsider = await createEmployee(org)

    const received = await feedback(colleague.employee!, report.employee!)
    const hiddenFromManager = await feedback(colleague.employee!, report.employee!, {
      visibleToManager: false,
    })
    const sent = await feedback(report.employee!, outsider)
    const unrelated = await feedback(colleague.employee!, outsider)
    const foreignOrg = await createHrOrganization('Autre')
    await feedback(null, await createEmployee(foreignOrg))
    const get = (who: { accessToken: string }, query = '') =>
      expectStatus(orgCall(client, 'GET', `/performance/feedback${query}`, who, org), 200)

    assert.sameMembers(ids(await get(hr)), [
      received.id,
      hiddenFromManager.id,
      sent.id,
      unrelated.id,
    ])
    assert.sameMembers(ids(await get(report)), [received.id, hiddenFromManager.id, sent.id])
    assert.sameMembers(ids(await get(manager)), [received.id])
    assert.sameMembers(ids(await get(colleague)), [received.id, hiddenFromManager.id, unrelated.id])
    assert.deepEqual(
      ids(await get(hr, `?filter[toEmployeeId]=${outsider.id}&filter[kind]=kudos`)).length,
      2
    )
  })

  test('a private feedback hides its author from everyone but HR and the author', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const author = await hrSession(client, org, ['employee'])
    const recipient = await hrSession(client, org, ['employee'])
    const created = await expectStatus(
      orgCall(client, 'POST', '/performance/feedback', author, org).json({
        toEmployeeId: recipient.employee!.id,
        kind: 'suggestion',
        message: 'Documente davantage',
        isPrivate: true,
      }),
      201
    )
    const id = created.body().data.id
    const authorOf = async (who: { accessToken: string }) => {
      const response = await expectStatus(
        orgCall(client, 'GET', '/performance/feedback', who, org),
        200
      )
      const rows = response.body().data as Array<{ id: string; fromEmployeeId: string | null }>
      return rows.find((row) => row.id === id)!.fromEmployeeId
    }

    assert.isNull(await authorOf(recipient))
    assert.equal(await authorOf(author), author.employee!.id)
    assert.equal(await authorOf(hr), author.employee!.id)
  })
})

test.group('DELETE /org/performance/feedback/:id', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('the author or HR delete; never the recipient, even HR', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const author = await hrSession(client, org, ['employee'])
    const recipient = await hrSession(client, org, ['employee'])
    const first = await feedback(author.employee!, recipient.employee!)
    const second = await feedback(author.employee!, recipient.employee!)
    const toHr = await feedback(author.employee!, hr.employee!)
    const del = (who: { accessToken: string }, id: string) =>
      orgCall(client, 'DELETE', `/performance/feedback/${id}`, who, org)

    await expectStatus(del(recipient, first.id), 403)
    await expectStatus(del(hr, toHr.id), 403)
    await expectStatus(del(author, first.id), 204)
    await expectStatus(del(hr, second.id), 204)
    const row = await Feedback.findOrFail(first.id)
    assert.isNotNull(row.deletedAt)
    await expectStatus(del(author, first.id), 404)

    const foreignOrg = await createHrOrganization('Autre')
    const foreign = await feedback(null, await createEmployee(foreignOrg))
    await expectStatus(del(hr, foreign.id), 404)
  })
})

test.group('Achievements', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('self, team manager and HR record and read; scope and tenant apply', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const colleague = await hrSession(client, org, ['employee'])
    const goal = await createGoal(report.employee!)
    const otherGoal = await createGoal(colleague.employee!)
    const post = (who: { accessToken: string }, body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/performance/achievements', who, org).json({
        title: 'Clôture annuelle sans réserve',
        achievedAt: '2026-10-15T10:00:00Z',
        ...body,
      })

    const own = await expectStatus(post(report, { goalId: goal.id, impact: 'Audit réussi' }), 201)
    assert.equal(own.body().data.employeeId, report.employee!.id)
    assert.equal(own.body().data.achievedAt, '2026-10-15T10:00:00.000Z')
    await expectStatus(post(manager, { employeeId: report.employee!.id }), 201)
    await expectStatus(post(colleague, { employeeId: report.employee!.id }), 403)
    await expectStatus(post(hr, { employeeId: colleague.employee!.id }), 201)
    await expectStatus(post(report, { goalId: otherGoal.id }), 422)
    await expectStatus(post(report, { achievedAt: 'hier' }), 422)

    const list = async (who: { accessToken: string }) => {
      const response = await expectStatus(
        orgCall(client, 'GET', '/performance/achievements', who, org),
        200
      )
      return response.body().data.length
    }
    assert.equal(await list(hr), 3)
    assert.equal(await list(manager), 2)
    assert.equal(await list(report), 2)
    assert.equal(await list(colleague), 1)
  })

  test('the author or HR delete; another organization is not found', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const byManager = await Achievement.create({
      organizationId: org.id,
      employeeId: report.employee!.id,
      title: 'Prime de projet',
      achievedAt: DateTime.now(),
      createdBy: manager.user.id,
    })
    const del = (who: { accessToken: string }, id: string) =>
      orgCall(client, 'DELETE', `/performance/achievements/${id}`, who, org)

    await expectStatus(del(report, byManager.id), 403)
    await expectStatus(del(manager, byManager.id), 204)
    const row = await Achievement.findOrFail(byManager.id)
    assert.isNotNull(row.deletedAt)

    const foreignOrg = await createHrOrganization('Autre')
    const stranger = await createEmployee(foreignOrg)
    const foreign = await Achievement.create({
      organizationId: foreignOrg.id,
      employeeId: stranger.id,
      title: 'x',
      achievedAt: DateTime.now(),
    })
    await expectStatus(del(hr, foreign.id), 404)
  })
})
