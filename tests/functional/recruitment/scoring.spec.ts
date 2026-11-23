import { test } from '@japa/runner'
import drive from '@adonisjs/drive/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import type { ApiClient } from '@japa/api-client'
import Candidate from '#models/candidate'
import CandidateEvent from '#models/candidate_event'
import Notification from '#models/notification'
import type Organization from '#models/organization'
import WebhookReceipt from '#models/webhook_receipt'
import outbound, { signBody, type OutboundResult } from '#shared/http/outbound'
import queueService, { backoffDelay } from '#shared/queue/queue_service'
import scoringService from '#modules/recruitment/services/scoring_service'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { hrSession, orgCall } from '#tests/helpers/hr'
import { createPublishedJob, createRecruitingOrganization } from '#tests/helpers/recruitment'

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'latin1')
const RESULT = [
  {
    candidate_name: 'Mariama Sow',
    is_valid_cv: true,
    match_score: 82,
    strengths: ['OHADA'],
    weaknesses_or_missing: ['Anglais'],
    summary_opinion: 'Très bon profil.',
    fraud_alert: false,
    cv_url: 'https://n8n.example.com/files/cv.pdf',
  },
]

type Sent = { url: string; payload: Record<string, any>; secret: string }

/** Replaces the outbound client and the queue for one test; restored afterwards. */
function stubNetwork(answer: Partial<OutboundResult> = {}) {
  const sent: Sent[] = []
  const dispatched: Array<{ name: string; payload: Record<string, any> }> = []
  const originalPost = outbound.postSigned
  const originalDispatch = queueService.dispatch
  outbound.postSigned = async (url, payload, secret) => {
    sent.push({ url, payload: payload as Record<string, any>, secret })
    return { status: 200, latencyMs: 12, body: '', error: null, ...answer }
  }
  queueService.dispatch = (async (name: string, payload: Record<string, any>) => {
    dispatched.push({ name, payload })
  }) as typeof queueService.dispatch
  return {
    sent,
    dispatched,
    restore() {
      outbound.postSigned = originalPost
      queueService.dispatch = originalDispatch
    },
  }
}

async function configure(client: ApiClient, organization: Organization) {
  const owner = await hrSession(client, organization, ['owner'])
  const response = await expectStatus(
    orgCall(client, 'PUT', '/recruitment/webhooks', owner, organization).json({
      testWebhookUrl: 'https://n8n.example.com/webhook/scoring-test',
      activeEnv: 'test',
    }),
    200
  )
  return { owner, secret: response.body().data.secret as string }
}

function applyOnce(client: ApiClient, organization: Organization, jobSlug: string) {
  return client
    .post(`/api/v1/public/careers/${organization.slug}/jobs/${jobSlug}/apply`)
    .field('fullName', 'Mariama Sow')
    .field('email', 'mariama@example.com')
    .field('phone', '622 12 34 56')
    .file('cv', PDF, { filename: 'cv.pdf' })
}

function callback(
  client: ApiClient,
  organizationId: string,
  candidateId: string,
  body: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000)
) {
  return client
    .post(
      `/api/v1/webhooks/n8n/scoring?organizationId=${organizationId}&candidateId=${candidateId}`
    )
    .header('content-type', 'application/json')
    .header('x-konkoure-timestamp', String(timestamp))
    .header('x-konkoure-signature', `sha256=${signBody(body, secret)}`)
    .json(JSON.parse(body))
}

test.group('Recruitment webhook settings', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('owner and hr_admin set the URLs; the secret is shown once', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const recruiter = await hrSession(client, org, ['recruiter'])
    const put = (body: Record<string, unknown>) =>
      orgCall(client, 'PUT', '/recruitment/webhooks', hr, org).json(body)

    const empty = await expectStatus(orgCall(client, 'GET', '/recruitment/webhooks', hr, org), 200)
    assert.deepInclude(empty.body().data, { activeEnv: 'off', hasSecret: false })

    const first = await expectStatus(
      put({ prodWebhookUrl: 'https://n8n.example.com/webhook/scoring', activeEnv: 'prod' }),
      200
    )
    assert.match(first.body().data.secret, /^[0-9a-f]{64}$/)
    const again = await expectStatus(put({ activeEnv: 'off' }), 200)
    assert.notProperty(again.body().data, 'secret')
    const rotated = await expectStatus(put({ rotateSecret: true }), 200)
    assert.notEqual(rotated.body().data.secret, first.body().data.secret)
    const shown = await expectStatus(orgCall(client, 'GET', '/recruitment/webhooks', hr, org), 200)
    assert.notProperty(shown.body().data, 'secret')
    assert.isTrue(shown.body().data.hasSecret)

    for (const url of ['http://n8n.example.com/x', 'https://10.0.0.1/x', 'https://localhost/x']) {
      const refused = await expectStatus(put({ testWebhookUrl: url }), 422)
      assert.equal(errorOf(refused).details[0].field, 'testWebhookUrl')
    }
    await expectStatus(put({ activeEnv: 'test' }), 422)
    await expectStatus(orgCall(client, 'GET', '/recruitment/webhooks', recruiter, org), 403)
  })

  test('ping sends a signed webhook.ping and reports the diagnosis', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'])
    await expectStatus(orgCall(client, 'POST', '/recruitment/webhooks/ping', owner, org), 422)
    const { secret } = await configure(client, org)
    const network = stubNetwork({ status: 204, latencyMs: 40 })
    try {
      const response = await expectStatus(
        orgCall(client, 'POST', '/recruitment/webhooks/ping', owner, org),
        200
      )
      assert.deepEqual(response.body().data, {
        env: 'test',
        ok: true,
        status: 204,
        latencyMs: 40,
        error: null,
      })
      assert.equal(network.sent[0].payload.event, 'webhook.ping')
      assert.equal(network.sent[0].secret, secret)
    } finally {
      network.restore()
    }
  })
})

test.group('n8n scoring (07 §4.4)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    drive.fake('s3')
    return () => drive.restore('s3')
  })

  test('a public application is scored, only when a webhook is active', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const job = await createPublishedJob(org)
    const network = stubNetwork()
    try {
      await expectStatus(applyOnce(client, org, job.slug), 201)
      assert.lengthOf(
        network.dispatched.filter((d) => d.name === 'candidates.score'),
        0
      )

      await configure(client, org)
      const other = await createPublishedJob(org)
      const response = await expectStatus(applyOnce(client, org, other.slug), 201)
      const [scheduled] = network.dispatched.filter((d) => d.name === 'candidates.score')
      assert.deepEqual(scheduled.payload, {
        organizationId: org.id,
        candidateId: response.body().data.candidateId,
      })
    } finally {
      network.restore()
    }
  })

  test('the call is signed, carries signed links and no contact data', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    await hrSession(client, org, ['recruiter'])
    const { secret } = await configure(client, org)
    const job = await createPublishedJob(org)
    const network = stubNetwork({ body: JSON.stringify(RESULT) })
    try {
      const applied = await expectStatus(applyOnce(client, org, job.slug), 201)
      const candidateId = applied.body().data.candidateId
      const outcome = await scoringService.run({ organizationId: org.id, candidateId })
      assert.equal(outcome, 'scored')

      const [call] = network.sent
      assert.equal(call.url, 'https://n8n.example.com/webhook/scoring-test')
      assert.equal(call.secret, secret)
      assert.equal(call.payload.candidate.id, candidateId)
      assert.notProperty(call.payload.candidate, 'email')
      assert.notProperty(call.payload.candidate, 'phone')
      assert.equal(call.payload.candidate.documents[0].key, 'cv')
      assert.include(call.payload.callback.url, `candidateId=${candidateId}`)

      const candidate = await Candidate.findOrFail(candidateId)
      assert.equal(candidate.aiScore, 82)
      assert.equal(candidate.aiJustification, 'Très bon profil.')
      assert.deepEqual(candidate.aiWeaknesses, ['Anglais'])
      assert.isFalse(candidate.aiFraudAlert)
      assert.isNotNull(candidate.aiScoredAt)
      assert.equal(candidate.stage, 'new')
      const [event] = await CandidateEvent.query()
        .where('candidate_id', candidateId)
        .where('type', 'scored')
      assert.deepEqual(event.payload, { score: 82 })
      assert.lengthOf(
        await Notification.query()
          .where('organization_id', org.id)
          .where('type', 'candidate.scored'),
        1
      )
    } finally {
      network.restore()
    }
  })

  test('a failing call throws for the retries; an empty 2xx waits for the callback', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    await configure(client, org)
    const job = await createPublishedJob(org)
    let network = stubNetwork({ status: 502 })
    try {
      const applied = await expectStatus(applyOnce(client, org, job.slug), 201)
      const candidateId = applied.body().data.candidateId
      await assert.rejects(() => scoringService.run({ organizationId: org.id, candidateId }))
      network.restore()
      network = stubNetwork({ status: 202, body: '{"accepted":true}' })
      assert.equal(
        await scoringService.run({ organizationId: org.id, candidateId }),
        'awaiting_callback'
      )
      const candidate = await Candidate.findOrFail(candidateId)
      assert.isNull(candidate.aiScore)
    } finally {
      network.restore()
    }
    assert.deepEqual(
      [1, 2, 3].map((attempt) => backoffDelay(attempt, 'candidates.score')),
      [30_000, 300_000, 1_800_000]
    )
  })

  test('the signed callback is applied once; bad, stale or invalid ones change nothing', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const { secret } = await configure(client, org)
    const job = await createPublishedJob(org)
    const network = stubNetwork()
    try {
      const applied = await expectStatus(applyOnce(client, org, job.slug), 201)
      const candidateId = applied.body().data.candidateId
      const body = JSON.stringify(RESULT)

      await expectStatus(callback(client, org.id, candidateId, body, 'mauvais-secret'), 401)
      const stale = Math.floor(Date.now() / 1000) - 600
      await expectStatus(callback(client, org.id, candidateId, body, secret, stale), 401)

      const accepted = await expectStatus(callback(client, org.id, candidateId, body, secret), 200)
      assert.isFalse(accepted.body().data.duplicate)
      const replay = await expectStatus(callback(client, org.id, candidateId, body, secret), 200)
      assert.isTrue(replay.body().data.duplicate)

      const results = network.dispatched.filter((d) => d.name === 'candidates.score-result')
      assert.lengthOf(results, 1)
      await scoringService.processReceipt(results[0].payload as { receiptId: string })
      const scored = await Candidate.findOrFail(candidateId)
      assert.equal(scored.aiScore, 82)

      // A non-conforming payload keeps the stored values and is journaled.
      const invalid = JSON.stringify({ match_score: 'beaucoup' })
      await expectStatus(callback(client, org.id, candidateId, invalid, secret), 200)
      const [later] = network.dispatched
        .filter((d) => d.name === 'candidates.score-result')
        .slice(-1)
      assert.equal(
        await scoringService.processReceipt(later.payload as { receiptId: string }),
        'invalid_payload'
      )
      const kept = await Candidate.findOrFail(candidateId)
      assert.equal(kept.aiScore, 82)
      const receipt = await WebhookReceipt.findOrFail(later.payload.receiptId)
      assert.equal(receipt.error, 'invalid_payload')
    } finally {
      network.restore()
    }
  })

  test('no endpoint rescoring a candidate exists', async ({ client }) => {
    const org = await createRecruitingOrganization()
    const recruiter = await hrSession(client, org, ['recruiter'])
    const job = await createPublishedJob(org)
    const candidate = await Candidate.create({
      organizationId: org.id,
      jobId: job.id,
      fullName: 'Test',
    })
    for (const path of ['score', 'rescore', 'scoring']) {
      await expectStatus(
        orgCall(client, 'POST', `/recruitment/candidates/${candidate.id}/${path}`, recruiter, org),
        404
      )
    }
  })
})
