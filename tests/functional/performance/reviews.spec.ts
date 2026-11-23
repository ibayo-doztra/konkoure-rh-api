import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import Goal from '#models/goal'
import Notification from '#models/notification'
import PerformanceReview from '#models/performance_review'
import type Organization from '#models/organization'
import {
  ReviewOpenedMail,
  ReviewSentBackMail,
  ReviewSignedMail,
} from '#modules/performance/mails/review_mails'
import reviewService from '#modules/performance/services/review_service'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { createCycle, createGoal, createPlan } from '#tests/helpers/performance'

const notificationsOf = (organizationId: string, type: string) =>
  Notification.query().where('organization_id', organizationId).where('type', type)

function createReview(
  organization: Organization,
  employeeId: string,
  overrides: Partial<{
    cycleId: string
    managerId: string | null
    status: PerformanceReview['status']
    managerScore: number
    managerGlobalComment: string
  }> = {}
) {
  return PerformanceReview.create({
    organizationId: organization.id,
    employeeId,
    ...overrides,
  })
}

test.group('POST /org/performance/reviews', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('opens one evaluation per present employee, idempotently', async ({ client, assert }) => {
    const { mails } = mail.fake()
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'], { linked: false })
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    await createEmployee(org, { status: 'terminated' })
    const cycle = await createCycle(org, {
      status: 'open',
      selfEvalClosesAt: DateTime.fromISO('2026-11-30T18:00:00Z'),
    })
    const plan = await createPlan(org)
    const planGoal = await createGoal(report.employee!, { planId: plan.id })
    const otherGoal = await createGoal(report.employee!)
    const open = () =>
      orgCall(client, 'POST', '/performance/reviews', hr, org).json({
        cycleId: cycle.id,
        planId: plan.id,
      })

    const first = await expectStatus(open(), 201)
    assert.lengthOf(first.body().data.created, 2)
    assert.equal(first.body().data.skipped, 0)
    const second = await expectStatus(open(), 201)
    assert.deepEqual(second.body().data, { created: [], skipped: 2 })

    const review = await PerformanceReview.query()
      .where('employee_id', report.employee!.id)
      .firstOrFail()
    assert.equal(review.status, 'not_started')
    assert.equal(review.managerId, manager.employee!.id)
    const attached = await Goal.findOrFail(planGoal.id)
    const untouched = await Goal.findOrFail(otherGoal.id)
    assert.equal(attached.reviewId, review.id)
    assert.isNull(untouched.reviewId)

    mails.assertQueuedCount(ReviewOpenedMail, 2)
    mails.assertQueued(ReviewOpenedMail, (message) => message.message.hasTo(report.user.email))
    assert.lengthOf(await notificationsOf(org.id, 'review.opened'), 2)
  })

  test('only owner and hr_admin open; the cycle must be open', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const draft = await createCycle(org)
    const open = await createCycle(org, { status: 'open' })
    const foreign = await createCycle(await createHrOrganization('Autre'), { status: 'open' })
    const post = (who: { accessToken: string }, body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/performance/reviews', who, org).json(body)

    await expectStatus(post(manager, { cycleId: open.id }), 403)
    const closed = await expectStatus(post(owner, { cycleId: draft.id }), 409)
    assert.equal(errorOf(closed).details[0].rule, 'cycleNotOpen')
    await expectStatus(post(owner, { cycleId: foreign.id }), 422)
    await expectStatus(post(owner, {}), 422)
    const listed = await expectStatus(
      post(owner, { cycleId: open.id, employeeIds: [manager.employee!.id] }),
      201
    )
    assert.lengthOf(listed.body().data.created, 1)
    const outsider = await createEmployee(await createHrOrganization('Tierce'))
    await expectStatus(post(owner, { cycleId: open.id, employeeIds: [outsider.id] }), 422)
  })
})

test.group('Evaluation lifecycle (07 §5.7)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('self → submit → send back → resubmit → validate → sign', async ({ client, assert }) => {
    const { mails } = mail.fake()
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const cycle = await createCycle(org, { status: 'open' })
    const review = await createReview(org, report.employee!.id, {
      cycleId: cycle.id,
      managerId: manager.employee!.id,
    })
    const goal = await createGoal(report.employee!, { reviewId: review.id })
    const foreignGoal = await createGoal(report.employee!)
    const path = `/performance/reviews/${review.id}`
    const call = (method: string, suffix: string, who: { accessToken: string }) =>
      orgCall(client, method, `${path}${suffix}`, who, org)

    const saved = await expectStatus(
      call('PATCH', '/self', report).json({
        selfScore: 4,
        selfGlobalComment: 'Bonne année',
        goals: [{ goalId: goal.id, comment: 'Atteint', rating: 4 }],
      }),
      200
    )
    assert.equal(saved.body().data.status, 'in_progress')
    assert.equal(saved.body().data.goals[0].selfRating, 4)
    await expectStatus(
      call('PATCH', '/self', report).json({ goals: [{ goalId: foreignGoal.id, rating: 3 }] }),
      422
    )
    await expectStatus(call('PATCH', '/self', report).json({ selfScore: 6 }), 422)

    // The manager side waits for the submission.
    await expectStatus(call('PATCH', '/manager', manager).json({ managerScore: 3 }), 409)
    await expectStatus(call('POST', '/submit-self', report), 200)
    const [submitted] = await notificationsOf(org.id, 'review.submitted')
    assert.equal(submitted.userId, manager.user.id)
    await expectStatus(call('PATCH', '/self', report).json({ selfScore: 5 }), 409)

    await expectStatus(
      call('PATCH', '/manager', manager).json({
        managerScore: 3,
        goals: [{ goalId: goal.id, comment: 'À consolider', rating: 3 }],
      }),
      200
    )
    // Hidden from the employee while submitted.
    const hidden = await expectStatus(call('GET', '', report), 200)
    assert.isNull(hidden.body().data.managerScore)
    assert.isNull(hidden.body().data.goals[0].managerComment)
    const managerView = await expectStatus(call('GET', '', manager), 200)
    assert.equal(managerView.body().data.managerScore, 3)

    await expectStatus(call('POST', '/send-back', manager), 422)
    const sentBack = await expectStatus(
      call('POST', '/send-back', manager).json({ comment: 'Détaillez le 2e objectif' }),
      200
    )
    assert.equal(sentBack.body().data.status, 'sent_back')
    mails.assertQueued(ReviewSentBackMail, (message) => message.message.hasTo(report.user.email))
    const visible = await expectStatus(call('GET', '', report), 200)
    assert.equal(visible.body().data.sentBackComment, 'Détaillez le 2e objectif')
    assert.equal(visible.body().data.managerScore, 3)
    assert.equal(visible.body().data.goals[0].managerComment, 'À consolider')

    await expectStatus(call('PATCH', '/self', report).json({ selfScore: 3 }), 200)
    await expectStatus(call('POST', '/submit-self', report), 200)

    const incomplete = await expectStatus(call('POST', '/validate', manager), 422)
    assert.equal(errorOf(incomplete).details[0].field, 'managerScore')
    await expectStatus(
      call('PATCH', '/manager', manager).json({ managerGlobalComment: 'Année solide' }),
      200
    )
    await expectStatus(call('POST', '/sign', report), 409)
    const validated = await expectStatus(call('POST', '/validate', manager), 200)
    assert.equal(validated.body().data.status, 'validated')
    assert.equal(validated.body().data.validatedBy, manager.user.id)
    assert.lengthOf(await notificationsOf(org.id, 'review.validated'), 1)

    await expectStatus(call('POST', '/sign', manager), 403)
    const signed = await expectStatus(call('POST', '/sign', report), 200)
    assert.equal(signed.body().data.status, 'signed')
    assert.equal(signed.body().data.signedBy, report.user.id)
    mails.assertQueued(ReviewSignedMail, (message) => message.message.hasTo(manager.user.email))
    mails.assertQueued(ReviewSignedMail, (message) => message.message.hasTo(hr.user.email))

    // Signed is terminal.
    await expectStatus(call('PATCH', '/self', report).json({ selfScore: 5 }), 409)
    await expectStatus(call('PATCH', '/manager', manager).json({ managerScore: 5 }), 409)
    await expectStatus(call('POST', '/sign', report), 409)
  })

  test('roles: self for self-evaluation, O H or manager for the rest, never on one’s own', async ({
    client,
  }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const colleague = await hrSession(client, org, ['employee'])
    const review = await createReview(org, report.employee!.id, { status: 'submitted' })
    const own = await createReview(org, owner.employee!.id, { status: 'submitted' })
    const path = `/performance/reviews/${review.id}`

    await expectStatus(orgCall(client, 'GET', path, colleague, org), 403)
    await expectStatus(orgCall(client, 'PATCH', `${path}/self`, manager, org).json({}), 403)
    await expectStatus(
      orgCall(client, 'PATCH', `${path}/manager`, report, org).json({ managerScore: 4 }),
      403
    )
    await expectStatus(
      orgCall(client, 'PATCH', `${path}/manager`, colleague, org).json({ managerScore: 4 }),
      403
    )
    await expectStatus(
      orgCall(client, 'PATCH', `/performance/reviews/${own.id}/manager`, owner, org).json({
        managerScore: 4,
      }),
      403
    )
    await expectStatus(
      orgCall(client, 'PATCH', `${path}/manager`, owner, org).json({ managerScore: 4 }),
      200
    )
  })

  test('lists are scoped; another organization is not found', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const outsider = await createEmployee(org)
    const team = await createReview(org, report.employee!.id)
    const unrelated = await createReview(org, outsider.id, { status: 'signed' })
    const foreignOrg = await createHrOrganization('Autre')
    const stranger = await createEmployee(foreignOrg)
    const foreign = await createReview(foreignOrg, stranger.id)
    const ids = async (who: { accessToken: string }, query = '') => {
      const response = await expectStatus(
        orgCall(client, 'GET', `/performance/reviews${query}`, who, org),
        200
      )
      return response.body().data.map((row: { id: string }) => row.id)
    }

    assert.sameMembers(await ids(owner), [team.id, unrelated.id])
    assert.deepEqual(await ids(manager), [team.id])
    assert.deepEqual(await ids(report), [team.id])
    assert.deepEqual(await ids(owner, '?filter[status]=signed'), [unrelated.id])
    await expectStatus(
      orgCall(client, 'GET', `/performance/reviews/${foreign.id}`, owner, org),
      404
    )
    await expectStatus(
      orgCall(client, 'POST', `/performance/reviews/${foreign.id}/validate`, owner, org),
      404
    )
  })
})

test.group('reviews:reminders', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('reminds late self-evaluations and waiting managers of open cycles', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const late = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const early = await hrSession(client, org, ['employee'])
    const done = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const at = DateTime.fromISO('2026-11-23T08:00:00Z')
    const closing = await createCycle(org, {
      status: 'open',
      selfEvalClosesAt: DateTime.fromISO('2026-11-27T18:00:00Z'),
    })
    const distant = await createCycle(org, {
      status: 'open',
      selfEvalClosesAt: DateTime.fromISO('2026-12-31T18:00:00Z'),
    })
    await createReview(org, late.employee!.id, { cycleId: closing.id })
    await createReview(org, early.employee!.id, { cycleId: distant.id })
    await createReview(org, done.employee!.id, {
      cycleId: closing.id,
      status: 'submitted',
      managerId: manager.employee!.id,
    })

    await reviewService.reminders(at)

    const reminders = await notificationsOf(org.id, 'review.reminder')
    assert.sameMembers(
      reminders.map((row) => row.userId),
      [late.user.id, manager.user.id]
    )
  })
})

test.group('Dashboard performance block', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('counts evaluations and averages live goals within the scope', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const employee = await hrSession(client, org, ['employee'])
    const other = await createEmployee(org)
    await createReview(org, employee.employee!.id, { status: 'in_progress' })
    const signed = await createReview(org, other.id, { status: 'signed' })
    signed.signedAt = DateTime.now()
    await signed.save()
    await createGoal(employee.employee!, { progress: 40 })
    await createGoal(other, { progress: 80 })
    await createGoal(other, { progress: 0, status: 'cancelled' })

    const all = await expectStatus(orgCall(client, 'GET', '/dashboard', owner, org), 200)
    assert.deepEqual(all.body().data.performance, {
      reviewsInProgress: 1,
      reviewsSigned: 1,
      avgGoalProgress: 60,
    })
    const self = await expectStatus(orgCall(client, 'GET', '/dashboard', employee, org), 200)
    assert.deepEqual(self.body().data.performance, {
      reviewsInProgress: 1,
      reviewsSigned: 0,
      avgGoalProgress: 40,
    })
  })
})
