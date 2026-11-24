import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import Candidate from '#models/candidate'
import CandidateEvent from '#models/candidate_event'
import RecruitmentWebhookConfig from '#models/recruitment_webhook_config'
import Feedback from '#models/feedback'
import Goal from '#models/goal'
import type Organization from '#models/organization'
import PerformanceReview from '#models/performance_review'
import UsageCounter from '#models/usage_counter'
import UsageEvent from '#models/usage_event'
import aiCreditService from '#modules/billing/services/ai_credit_service'
import aiService, { type AiCompletionRequest } from '#modules/integrations/services/ai_service'
import scoringService from '#modules/recruitment/services/scoring_service'
import { jobs, type JobName } from '#shared/queue/jobs'
import queueService from '#shared/queue/queue_service'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { createCycle } from '#tests/helpers/performance'
import { createJob, createRecruitingOrganization } from '#tests/helpers/recruitment'

const period = () => DateTime.now().toUTC().toFormat('yyyy-MM')

/** Fake model: answers in turn, records the requests; jobs are captured, run by `drain`. */
function fakeAi(...answers: unknown[]) {
  const requests: AiCompletionRequest[] = []
  const original = aiService.completer
  aiService.completer = async (request) => {
    requests.push(request)
    const answer = answers.length > 1 ? answers.shift() : answers[0]
    return typeof answer === 'string' ? answer : JSON.stringify(answer)
  }
  const dispatched: Array<{ name: JobName; payload: unknown }> = []
  const originalDispatch = queueService.dispatch
  queueService.dispatch = (async (name: JobName, payload: unknown) => {
    dispatched.push({ name, payload })
  }) as typeof queueService.dispatch
  return {
    requests,
    dispatched,
    async drain() {
      while (dispatched.length > 0) {
        const job = dispatched.shift()!
        await (jobs[job.name].handle as (payload: unknown) => Promise<unknown>)(job.payload)
      }
    },
    restore() {
      aiService.completer = original
      queueService.dispatch = originalDispatch
    },
  }
}

const creditsUsed = async (organization: Organization) => {
  const counter = await UsageCounter.query()
    .where('organization_id', organization.id)
    .where('period', period())
    .where('metric', 'ai_credits')
    .first()
  return counter?.used ?? 0
}

async function exhaustCredits(organization: Organization, limit: number) {
  await UsageCounter.create({
    organizationId: organization.id,
    period: period(),
    metric: 'ai_credits',
    used: limit,
    limitValue: limit,
  })
}

const keyResults = (count: number) => ({
  keyResults: Array.from({ length: count }, (_, index) => ({
    title: `Résultat clé ${index + 1}`,
    metric: 'Clients actifs',
    targetValue: 100 + index,
    unit: 'clients',
  })),
})

test.group('POST /org/performance/okrs/suggest', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('suggests key results for one credit, recorded in usage_events', async ({
    client,
    assert,
  }) => {
    const ai = fakeAi(keyResults(4))
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])

    const response = await expectStatus(
      orgCall(client, 'POST', '/performance/okrs/suggest', employee, org).json({
        objective: 'Augmenter la base de clients actifs à Conakry',
        context: 'PME de distribution',
        count: 4,
      }),
      200
    )
    await ai.drain()
    ai.restore()
    assert.lengthOf(response.body().data.keyResults, 4)
    assert.deepInclude(response.body().data.keyResults[0], {
      title: 'Résultat clé 1',
      unit: 'clients',
    })
    assert.equal(await creditsUsed(org), 1)
    assert.equal(ai.requests[0].model, 'test-model')
    const usage = await UsageEvent.query().where('organization_id', org.id).firstOrFail()
    assert.deepInclude(usage.$attributes, { kind: 'ai', module: 'performance' })
    assert.equal(usage.metadata.task, 'okr.suggest')
  })

  test('refuses an exhausted quota without calling the model', async ({ client, assert }) => {
    const ai = fakeAi(keyResults(3))
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])
    await exhaustCredits(org, 20)

    const refused = await expectStatus(
      orgCall(client, 'POST', '/performance/okrs/suggest', employee, org).json({
        objective: 'Réduire les retards de livraison',
      }),
      403
    )
    ai.restore()
    assert.equal(errorOf(refused).code, 'E_AI_QUOTA_EXCEEDED')
    assert.lengthOf(ai.requests, 0)
  })

  test('a non-conforming answer is retried once, then refunded with 503', async ({
    client,
    assert,
  }) => {
    const ai = fakeAi('not json', { keyResults: [] })
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])

    const failed = await expectStatus(
      orgCall(client, 'POST', '/performance/okrs/suggest', employee, org).json({
        objective: 'Réduire les retards de livraison',
      }),
      503
    )
    ai.restore()
    assert.equal(errorOf(failed).code, 'E_AI_UNAVAILABLE')
    assert.lengthOf(ai.requests, 2)
    assert.equal(await creditsUsed(org), 0)
  })

  test('validates the request; a member without employee record is refused', async ({ client }) => {
    const ai = fakeAi(keyResults(3))
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])
    const unlinked = await hrSession(client, org, ['hr_admin'], { linked: false })
    const post = (who: { accessToken: string }, body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/performance/okrs/suggest', who, org).json(body)

    await expectStatus(post(employee, { objective: 'court' }), 422)
    await expectStatus(post(employee, { objective: 'Un objectif assez long', count: 6 }), 422)
    await expectStatus(post(unlinked, { objective: 'Un objectif assez long' }), 403)
    ai.restore()
  })
})

test.group('POST /org/performance/reviews/:id/ai-summary', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('the manager gets a stored synthesis the employee never sees', async ({
    client,
    assert,
  }) => {
    const ai = fakeAi({
      summary: 'Une année solide : objectifs commerciaux atteints, à renforcer.',
    })
    const org = await createHrOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'], {
      managerId: manager.employee!.id,
    })
    const cycle = await createCycle(org, { status: 'open' })
    const review = await PerformanceReview.create({
      organizationId: org.id,
      employeeId: employee.employee!.id,
      managerId: manager.employee!.id,
      cycleId: cycle.id,
      status: 'submitted',
      selfScore: 4,
      selfGlobalComment: 'Bonne année',
    })
    await Goal.create({
      organizationId: org.id,
      employeeId: employee.employee!.id,
      reviewId: review.id,
      title: 'Ouvrir 3 agences',
      progress: 100,
      status: 'achieved',
    })
    await Feedback.createMany([
      {
        organizationId: org.id,
        toEmployeeId: employee.employee!.id,
        fromEmployeeId: manager.employee!.id,
        kind: 'kudos',
        message: 'Bravo pour le lancement',
      },
      {
        organizationId: org.id,
        toEmployeeId: employee.employee!.id,
        fromEmployeeId: manager.employee!.id,
        kind: 'concern',
        message: 'Message privé',
        isPrivate: true,
      },
    ])

    const response = await expectStatus(
      orgCall(client, 'POST', `/performance/reviews/${review.id}/ai-summary`, manager, org),
      200
    )
    ai.restore()
    assert.match(response.body().data.aiSummary, /Une année solide/)
    const prompt = JSON.parse(ai.requests[0].user)
    assert.deepEqual(prompt.feedback, [{ kind: 'kudos', message: 'Bravo pour le lancement' }])
    assert.equal(prompt.goals[0].title, 'Ouvrir 3 agences')

    const own = await expectStatus(
      orgCall(client, 'GET', `/performance/reviews/${review.id}`, employee, org),
      200
    )
    assert.isNull(own.body().data.aiSummary)
    await expectStatus(
      orgCall(client, 'POST', `/performance/reviews/${review.id}/ai-summary`, employee, org),
      403
    )
  })

  test('refuses an evaluation not started', async ({ client, assert }) => {
    const ai = fakeAi({ summary: 'Synthèse suffisamment longue pour passer.' })
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const evaluated = await createEmployee(org)
    const review = await PerformanceReview.create({
      organizationId: org.id,
      employeeId: evaluated.id,
    })
    const refused = await expectStatus(
      orgCall(client, 'POST', `/performance/reviews/${review.id}/ai-summary`, hr, org),
      409
    )
    ai.restore()
    assert.equal(errorOf(refused).details[0].rule, 'notStarted')
    assert.lengthOf(ai.requests, 0)
  })
})

test.group('POST /org/recruitment/jobs/:id/generate', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('returns a suggestion without storing it', async ({ client, assert }) => {
    const answer = {
      description: 'Nous recherchons un comptable rigoureux pour notre siège de Conakry. '.repeat(
        2
      ),
      requirements: 'Licence en comptabilité, 3 ans d’expérience',
    }
    const ai = fakeAi(answer)
    const org = await createRecruitingOrganization('Mienne')
    const other = await createRecruitingOrganization('Autre')
    const recruiter = await hrSession(client, org, ['recruiter'], { linked: false })
    const manager = await hrSession(client, org, ['manager'])
    const job = await createJob(org, { title: 'Comptable', location: 'Conakry' })
    const foreign = await createJob(other)

    const response = await expectStatus(
      orgCall(client, 'POST', `/recruitment/jobs/${job.id}/generate`, recruiter, org).json({
        notes: 'Poste basé à Kaloum',
        language: 'fr',
      }),
      200
    )
    assert.deepEqual(response.body().data, {
      description: answer.description.trim(),
      requirements: answer.requirements,
    })
    const before = job.description
    await job.refresh()
    assert.equal(job.description, before)
    const prompt = JSON.parse(ai.requests[0].user)
    assert.deepInclude(prompt, {
      title: 'Comptable',
      location: 'Conakry',
      notes: 'Poste basé à Kaloum',
    })
    assert.notProperty(prompt, 'salary')

    await expectStatus(
      orgCall(client, 'POST', `/recruitment/jobs/${job.id}/generate`, manager, org).json({}),
      403
    )
    await expectStatus(
      orgCall(client, 'POST', `/recruitment/jobs/${foreign.id}/generate`, recruiter, org).json({}),
      404
    )
    ai.restore()
  })
})

test.group('AI credits of the n8n scoring', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('an exhausted quota skips the scoring and traces why', async ({ assert }) => {
    const ai = fakeAi({})
    const org = await createRecruitingOrganization()
    await exhaustCredits(org, 500)
    const job = await createJob(org)
    const candidate = await Candidate.create({
      organizationId: org.id,
      jobId: job.id,
      fullName: 'Mariama Sow',
    })
    await RecruitmentWebhookConfig.create({
      organizationId: org.id,
      activeEnv: 'test',
      testWebhookUrl: 'https://n8n.example.com/webhook/scoring-test',
    })

    await scoringService.schedule(org.id, candidate.id)
    ai.restore()
    assert.lengthOf(
      ai.dispatched.filter((entry) => entry.name === 'candidates.score'),
      0
    )
    const event = await CandidateEvent.query()
      .where('candidate_id', candidate.id)
      .where('type', 'scoring_skipped')
      .firstOrFail()
    assert.deepEqual(event.payload, { reason: 'ai_quota' })
  })

  test('credits are reserved under the application role (RLS)', async ({ assert }) => {
    const org = await createRecruitingOrganization()
    await db.rawQuery('SET LOCAL ROLE konkoure_app')
    const reservation = await aiCreditService.reserve(org.id)
    await aiCreditService.refund(reservation)
    await aiCreditService.reserve(org.id)
    const { rows } = await db.rawQuery(
      `select used from usage_counters where organization_id = ? and metric = 'ai_credits'`,
      [org.id]
    )
    assert.deepEqual(rows, [{ used: 1 }])
  })

  test('a scoring given up returns its credit', async ({ assert }) => {
    const org = await createRecruitingOrganization()
    const reservation = await aiCreditService.reserve(org.id)
    assert.equal(await creditsUsed(org), 1)
    await scoringService.giveUp({
      organizationId: org.id,
      candidateId: 'unused',
      creditPeriod: reservation.period,
    })
    assert.equal(await creditsUsed(org), 0)
  })
})
