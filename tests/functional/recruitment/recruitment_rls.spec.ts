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
