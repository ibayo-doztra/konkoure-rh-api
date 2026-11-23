import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import redis from '@adonisjs/redis/services/main'
import Job from '#models/job'
import Organization from '#models/organization'
import { expectStatus } from '#tests/helpers/http'
import { createDepartment, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import {
  createJob,
  createPublishedJob,
  createRecruitingOrganization,
} from '#tests/helpers/recruitment'

const careers = (client: Parameters<typeof orgCall>[0], path: string) =>
  client.get(`/api/v1/public/careers${path}`)

test.group('GET /public/careers/:orgSlug', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(async () => {
    await redis.connection('cache').flushdb()
  })

  test('lists the open offers of the organization, without authentication', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const department = await createDepartment(org, 'Finance')
    const open = await createPublishedJob(org, {
      departmentId: department.id,
      deadline: DateTime.now().plus({ days: 10 }),
    })
    await createJob(org)
    await createPublishedJob(org, { deadline: DateTime.now().minus({ hours: 1 }) })
    await createPublishedJob(org, { status: 'closed' })

    const response = await expectStatus(careers(client, `/${org.slug}`), 200)
    const { organization, jobs } = response.body().data
    assert.deepEqual(organization, { name: org.name, slug: org.slug, logoUrl: null })
    assert.lengthOf(jobs, 1)
    assert.equal(jobs[0].slug, open.slug)
    assert.equal(jobs[0].department, 'Finance')
    assert.notProperty(jobs[0], 'id')
    assert.notProperty(jobs[0], 'viewsCount')
  })

  test('an organization without recruitment, deleted or unknown is not found', async ({
    client,
  }) => {
    const free = await createHrOrganization('Gratuite')
    await createPublishedJob(free)
    const deleted = await createRecruitingOrganization('Fermee')
    await Organization.query().where('id', deleted.id).update({ deleted_at: new Date() })

    await expectStatus(careers(client, `/${free.slug}`), 404)
    await expectStatus(careers(client, `/${deleted.slug}`), 404)
    await expectStatus(careers(client, '/inconnue'), 404)
    await expectStatus(careers(client, '/Pas_un_slug'), 422)
  })

  test('publishing refreshes the cached page', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const draft = await createJob(org)
    const first = await expectStatus(careers(client, `/${org.slug}`), 200)
    assert.lengthOf(first.body().data.jobs, 0)

    await expectStatus(
      orgCall(client, 'POST', `/recruitment/jobs/${draft.id}/publish`, owner, org),
      200
    )
    const second = await expectStatus(careers(client, `/${org.slug}`), 200)
    assert.lengthOf(second.body().data.jobs, 1)
  })
})

test.group('GET /public/careers/:orgSlug/jobs/:jobSlug', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('shows an open offer and counts the view', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const job = await createPublishedJob(org, {
      requirements: 'Licence en comptabilité',
      requiredDocuments: [{ key: 'diploma', label: 'Diplôme', required: true }],
    })

    const response = await expectStatus(careers(client, `/${org.slug}/jobs/${job.slug}`), 200)
    const body = response.body().data
    assert.equal(body.job.title, job.title)
    assert.equal(body.job.requirements, 'Licence en comptabilité')
    assert.deepEqual(body.job.requiredDocuments, job.requiredDocuments)
    assert.notProperty(body.job, 'id')
    const row = await Job.findOrFail(job.id)
    assert.equal(row.viewsCount, 1)
  })

  test('drafts, expired offers and other organizations are not found', async ({ client }) => {
    const org = await createRecruitingOrganization()
    const other = await createRecruitingOrganization('Autre')
    const draft = await createJob(org)
    const expired = await createPublishedJob(org, { deadline: DateTime.now().minus({ days: 1 }) })
    const foreign = await createPublishedJob(other)

    await expectStatus(careers(client, `/${org.slug}/jobs/${draft.slug}`), 404)
    await expectStatus(careers(client, `/${org.slug}/jobs/${expired.slug}`), 404)
    await expectStatus(careers(client, `/${org.slug}/jobs/${foreign.slug}`), 404)
  })
})
