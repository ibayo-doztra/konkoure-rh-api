import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import Notification from '#models/notification'
import Okr from '#models/okr'
import OkrCheckin from '#models/okr_checkin'
import okrService from '#modules/performance/services/okr_service'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { addKeyResults, createOkr } from '#tests/helpers/performance'

const ids = (response: { body(): { data: Array<{ id: string }> } }) =>
  response.body().data.map((row) => row.id)

const notificationsOf = (organizationId: string, type: string) =>
  Notification.query().where('organization_id', organizationId).where('type', type)

test.group('OKR lists and creation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('scopes OKRs by role and organization, with key results', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const own = await createOkr(manager.employee!)
    const team = await createOkr(report.employee!, { quarter: '2026-Q4' })
    await addKeyResults(team, [true, false, false])
    const unrelated = await createOkr(await createEmployee(org))
    await createOkr(await createEmployee(other))
    const get = (who: { accessToken: string }, query = '') =>
      expectStatus(orgCall(client, 'GET', `/performance/okrs${query}`, who, org), 200)

    assert.sameMembers(ids(await get(owner)), [own.id, team.id, unrelated.id])
    assert.sameMembers(ids(await get(manager)), [own.id, team.id])
    const mine = await get(report)
    assert.deepEqual(ids(mine), [team.id])
    assert.equal(mine.body().data[0].progress, 33)
    assert.lengthOf(mine.body().data[0].keyResults, 3)
    assert.deepEqual(ids(await get(owner, '?filter[quarter]=2026-Q4')), [team.id])
    await expectStatus(
      orgCall(client, 'GET', '/performance/okrs?filter[quarter]=2026-T4', owner, org),
      422
    )
  })

  test('everyone creates for themselves; others only for O H or the manager', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const outsider = await createEmployee(org)
    const post = (who: { accessToken: string }, body: Record<string, unknown> = {}) =>
      orgCall(client, 'POST', '/performance/okrs', who, org).json({
        quarter: '2026-Q3',
        objective: 'Réduire le turnover',
        ...body,
      })

    const created = await expectStatus(post(report), 201)
    assert.equal(created.body().data.employeeId, report.employee!.id)
    assert.equal(created.body().data.reviewStatus, 'draft')
    assert.equal(created.body().data.status, 'draft')
    await expectStatus(post(report, { employeeId: outsider.id }), 403)
    await expectStatus(post(manager, { employeeId: outsider.id }), 403)
    await expectStatus(post(manager, { employeeId: report.employee!.id }), 201)
    await expectStatus(post(hr, { employeeId: outsider.id }), 201)
    await expectStatus(post(report, { quarter: '2026-Q5' }), 422)
    await expectStatus(post(report, { objective: '' }), 422)
  })

  test('an OKR of another organization is not found', async ({ client }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const foreign = await createOkr(await createEmployee(await createHrOrganization('Autre')))
    const path = `/performance/okrs/${foreign.id}`
    await expectStatus(orgCall(client, 'GET', path, owner, org), 404)
    await expectStatus(orgCall(client, 'PATCH', path, owner, org).json({ objective: 'x' }), 404)
    await expectStatus(orgCall(client, 'POST', `${path}/validate`, owner, org), 404)
    await expectStatus(orgCall(client, 'GET', `${path}/checkins`, owner, org), 404)
  })
})

test.group('OKR lifecycle (07 §5.3)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('draft → pending → needs_revision → pending → validated', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const okr = await createOkr(report.employee!)
    const path = `/performance/okrs/${okr.id}`

    const empty = await expectStatus(orgCall(client, 'POST', `${path}/submit`, report, org), 422)
    assert.equal(errorOf(empty).details[0].field, 'keyResults')

    const replaced = await expectStatus(
      orgCall(client, 'PUT', `${path}/key-results`, report, org).json({
        keyResults: [
          { title: 'Réduire les erreurs de paie à 1 %', metric: 'erreurs', targetValue: 1 },
          { title: 'Former 3 gestionnaires', targetValue: 3, unit: 'personnes', isDone: true },
        ],
      }),
      200
    )
    assert.equal(replaced.body().data.progress, 50)
    assert.deepEqual(
      replaced.body().data.keyResults.map((row: { position: number }) => row.position),
      [1, 2]
    )

    const pending = await expectStatus(orgCall(client, 'POST', `${path}/submit`, report, org), 200)
    assert.equal(pending.body().data.reviewStatus, 'pending')
    assert.isNotNull(pending.body().data.submittedAt)
    const [submitted] = await notificationsOf(org.id, 'okr.submitted')
    assert.equal(submitted.userId, manager.user.id)

    // Pending: read-only for the holder.
    await expectStatus(orgCall(client, 'PATCH', path, report, org).json({ objective: 'x' }), 409)
    await expectStatus(
      orgCall(client, 'PUT', `${path}/key-results`, report, org).json({ keyResults: [] }),
      409
    )

    await expectStatus(orgCall(client, 'POST', `${path}/request-revision`, manager, org), 422)
    const revised = await expectStatus(
      orgCall(client, 'POST', `${path}/request-revision`, manager, org).json({
        comment: 'Résultat 1 trop vague',
      }),
      200
    )
    assert.equal(revised.body().data.reviewStatus, 'needs_revision')
    assert.equal(revised.body().data.managerComment, 'Résultat 1 trop vague')
    assert.lengthOf(await notificationsOf(org.id, 'okr.needs_revision'), 1)

    await expectStatus(
      orgCall(client, 'PATCH', path, report, org).json({ objective: 'Paie fiable' }),
      200
    )
    await expectStatus(orgCall(client, 'POST', `${path}/submit`, report, org), 200)
    const validated = await expectStatus(
      orgCall(client, 'POST', `${path}/validate`, manager, org),
      200
    )
    assert.equal(validated.body().data.reviewStatus, 'validated')
    assert.equal(validated.body().data.status, 'active')
    assert.equal(validated.body().data.validatedBy, manager.user.id)
    assert.lengthOf(await notificationsOf(org.id, 'okr.validated'), 1)

    // Validated: content frozen, progress still open.
    await expectStatus(orgCall(client, 'PATCH', path, report, org).json({ objective: 'x' }), 409)
    await expectStatus(orgCall(client, 'POST', `${path}/validate`, manager, org), 409)
  })

  test('only the holder submits; only O H or the manager decides, never on their own', async ({
    client,
  }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const colleague = await hrSession(client, org, ['employee'])
    const okr = await createOkr(report.employee!)
    await addKeyResults(okr, [false])
    const ownOkr = await createOkr(owner.employee!, { reviewStatus: 'pending' })
    const path = `/performance/okrs/${okr.id}`

    await expectStatus(orgCall(client, 'POST', `${path}/submit`, manager, org), 403)
    await expectStatus(orgCall(client, 'POST', `${path}/submit`, report, org), 200)
    await expectStatus(orgCall(client, 'POST', `${path}/validate`, report, org), 403)
    await expectStatus(orgCall(client, 'POST', `${path}/validate`, colleague, org), 403)
    await expectStatus(
      orgCall(client, 'POST', `/performance/okrs/${ownOkr.id}/validate`, owner, org),
      403
    )
    await expectStatus(orgCall(client, 'POST', `${path}/validate`, owner, org), 200)
  })

  test('the holder deletes a draft; O H at any time', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const employee = await hrSession(client, org, ['employee'])
    const draft = await createOkr(employee.employee!)
    const validated = await createOkr(employee.employee!, {
      reviewStatus: 'validated',
      status: 'active',
    })

    await expectStatus(
      orgCall(client, 'DELETE', `/performance/okrs/${validated.id}`, employee, org),
      409
    )
    await expectStatus(
      orgCall(client, 'DELETE', `/performance/okrs/${draft.id}`, employee, org),
      204
    )
    await expectStatus(orgCall(client, 'DELETE', `/performance/okrs/${validated.id}`, hr, org), 204)
    const row = await Okr.findOrFail(validated.id)
    assert.isNotNull(row.deletedAt)
  })
})

test.group('Key results progress and check-ins', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('the trigger recomputes the progress as key results are done', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const hr = await hrSession(client, org, ['hr_admin'])
    const okr = await createOkr(report.employee!, { reviewStatus: 'validated', status: 'active' })
    const [first, second, third] = await addKeyResults(okr, [false, false, false])
    const patch = (who: { accessToken: string }, krId: string, body: Record<string, unknown>) =>
      orgCall(client, 'PATCH', `/performance/okrs/${okr.id}/key-results/${krId}`, who, org).json(
        body
      )

    const one = await expectStatus(
      patch(report, first.id, { isDone: true, currentValue: 12.5 }),
      200
    )
    assert.equal(one.body().data.progress, 33)
    const row = one.body().data.keyResults[0]
    assert.equal(row.currentValue, 12.5)
    assert.isNotNull(row.doneAt)
    const two = await expectStatus(patch(manager, second.id, { isDone: true }), 200)
    assert.equal(two.body().data.progress, 67)
    await expectStatus(patch(hr, third.id, { isDone: true }), 403)
    const back = await expectStatus(patch(report, first.id, { isDone: false }), 200)
    assert.equal(back.body().data.progress, 33)
    assert.isNull(back.body().data.keyResults[0].doneAt)

    const pending = await createOkr(report.employee!, { reviewStatus: 'pending' })
    const [locked] = await addKeyResults(pending, [false])
    await expectStatus(
      orgCall(
        client,
        'PATCH',
        `/performance/okrs/${pending.id}/key-results/${locked.id}`,
        report,
        org
      ).json({ isDone: true }),
      409
    )
    await expectStatus(
      orgCall(
        client,
        'PATCH',
        `/performance/okrs/${okr.id}/key-results/${locked.id}`,
        report,
        org
      ).json({ isDone: true }),
      404
    )
  })

  test('check-ins follow a validated OKR and snapshot its progress', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const colleague = await hrSession(client, org, ['employee'])
    const okr = await createOkr(report.employee!, { reviewStatus: 'validated', status: 'active' })
    await addKeyResults(okr, [true, false])
    const draft = await createOkr(report.employee!)
    const path = `/performance/okrs/${okr.id}/checkins`

    const created = await expectStatus(
      orgCall(client, 'POST', path, report, org).json({ message: 'Premier mois bouclé' }),
      201
    )
    assert.equal(created.body().data.progressSnapshot, 50)
    assert.equal(created.body().data.authorEmployeeId, report.employee!.id)
    await expectStatus(
      orgCall(client, 'POST', path, manager, org).json({ message: 'Bon rythme' }),
      201
    )
    await expectStatus(orgCall(client, 'POST', path, colleague, org).json({ message: 'x' }), 403)
    await expectStatus(orgCall(client, 'POST', path, report, org).json({ message: '' }), 422)
    await expectStatus(
      orgCall(client, 'POST', `/performance/okrs/${draft.id}/checkins`, report, org).json({
        message: 'Trop tôt',
      }),
      409
    )

    const list = await expectStatus(orgCall(client, 'GET', path, manager, org), 200)
    assert.lengthOf(list.body().data, 2)
    await expectStatus(orgCall(client, 'GET', path, colleague, org), 403)
  })
})

test.group('okr:checkin-reminder', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('reminds holders of validated OKRs without a check-in this month', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const quiet = await hrSession(client, org, ['employee'])
    const active = await hrSession(client, org, ['employee'])
    const at = DateTime.fromISO('2026-06-25T09:00:00Z')
    const silent = await createOkr(quiet.employee!, { reviewStatus: 'validated', status: 'active' })
    const followed = await createOkr(active.employee!, {
      reviewStatus: 'validated',
      status: 'active',
    })
    await createOkr(quiet.employee!)
    const checkin = await OkrCheckin.create({
      organizationId: org.id,
      okrId: followed.id,
      message: 'Point de juin',
      progressSnapshot: 0,
    })
    checkin.createdAt = DateTime.fromISO('2026-06-10T10:00:00Z')
    await checkin.save()
    const old = await OkrCheckin.create({
      organizationId: org.id,
      okrId: silent.id,
      message: 'Point de mai',
      progressSnapshot: 0,
    })
    old.createdAt = DateTime.fromISO('2026-05-20T10:00:00Z')
    await old.save()

    await okrService.checkinReminders(at)

    const reminders = await notificationsOf(org.id, 'okr.checkin_reminder')
    assert.deepEqual(
      reminders.map((row) => row.userId),
      [quiet.user.id]
    )
  })
})
