import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import jobService from '#modules/recruitment/services/job_service'
import careersService from '#modules/recruitment/services/careers_service'
import { TenantContext } from '#shared/tenant/tenant_context'
import { createUser, grantRoles } from '#tests/helpers/auth'
import { createJob, createRecruitingOrganization } from '#tests/helpers/recruitment'

test.group('Recruitment services under the application role', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('job offers and careers pages work with RLS enforced', async ({ assert }) => {
    const org = await createRecruitingOrganization('Mienne')
    const other = await createRecruitingOrganization('Autre')
    const owner = await createUser({ emailVerifiedAt: DateTime.now() })
    await grantRoles(owner, org, ['owner'])
    const foreign = await createJob(other)
    const tenant = new TenantContext(org.id, ['owner'])

    await db.rawQuery('SET LOCAL ROLE konkoure_app')

    const job = await jobService.create(
      tenant,
      owner,
      { title: 'Comptable', contractType: 'cdi', description: 'Comptabilité générale.' },
      {}
    )
    await jobService.publish(tenant, owner, job.id, {})
    await jobService.duplicate(tenant, owner, job.id, {})
    const { meta } = await jobService.list(tenant, {})
    assert.equal(meta.total, 2)
    await assert.rejects(() => jobService.find(tenant, foreign.id), 'E_NOT_FOUND')

    const page = await careersService.page(org.slug)
    assert.lengthOf(page.jobs, 1)
    await careersService.job(org.slug, job.slug)
    await jobService.autoClose()
  })
})

test.group('Scoring services under the application role', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('webhook settings, receipts and results work with RLS enforced', async ({ assert }) => {
    const { default: webhookConfigService } =
      await import('#modules/recruitment/services/webhook_config_service')
    const { default: scoringService } =
      await import('#modules/recruitment/services/scoring_service')
    const { default: Candidate } = await import('#models/candidate')
    const org = await createRecruitingOrganization('Mienne')
    const owner = await createUser({ emailVerifiedAt: DateTime.now() })
    await grantRoles(owner, org, ['owner'])
    const job = await createJob(org)
    const candidate = await Candidate.create({
      organizationId: org.id,
      jobId: job.id,
      fullName: 'Test',
    })
    const tenant = new TenantContext(org.id, ['owner'])

    await db.rawQuery('SET LOCAL ROLE konkoure_app')

    const { secret } = await webhookConfigService.update(
      tenant,
      owner,
      { prodWebhookUrl: 'https://n8n.example.com/hook', activeEnv: 'prod' },
      {}
    )
    assert.isString(secret)
    await scoringService.apply(org.id, candidate.id, {
      aiScore: 70,
      aiJustification: null,
      aiStrengths: [],
      aiWeaknesses: [],
      aiCandidateName: null,
      aiIsValidCv: null,
      aiFraudAlert: null,
    })
    const scored = await Candidate.findOrFail(candidate.id)
    assert.equal(scored.aiScore, 70)
  })
})
