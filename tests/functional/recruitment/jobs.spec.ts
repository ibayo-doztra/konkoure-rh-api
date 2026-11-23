import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import Job from '#models/job'
import jobService from '#modules/recruitment/services/job_service'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createDepartment, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import {
  createJob,
  createPublishedJob,
  createRecruitingOrganization,
} from '#tests/helpers/recruitment'

const ids = (response: { body(): { data: Array<{ id: string }> } }) =>
  response.body().data.map((row) => row.id)

test.group('POST /org/recruitment/jobs', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('creates a draft with a server slug, suffixed on collision', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const recruiter = await hrSession(client, org, ['recruiter'], { linked: false })
    const department = await createDepartment(org)
    const post = (body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/recruitment/jobs', recruiter, org).json({
        title: 'Développeur Mobile Senior',
        contractType: 'cdi',
        ...body,
      })

    const first = await expectStatus(
      post({
        departmentId: department.id,
        location: 'Conakry',
        deadline: '2099-01-31T23:59:00Z',
        requiredDocuments: [{ key: 'diploma', label: 'Diplôme', required: true }],
      }),
      201
    )
    const job = first.body().data
    assert.equal(job.slug, 'developpeur-mobile-senior')
    assert.equal(job.status, 'draft')
    assert.deepEqual(job.requiredDocuments, [{ key: 'diploma', label: 'Diplôme', required: true }])
    const second = await expectStatus(post({}), 201)
    assert.equal(second.body().data.slug, 'developpeur-mobile-senior-2')
  })

  test('validates the offer', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const foreignDepartment = await createDepartment(await createRecruitingOrganization('Autre'))
    const post = (body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/recruitment/jobs', owner, org).json({
        title: 'Comptable',
        contractType: 'cdi',
        ...body,
      })

    await expectStatus(post({ contractType: 'interim' }), 422)
    await expectStatus(post({ title: '' }), 422)
    await expectStatus(post({ slug: 'impose' }), 201)
    const department = await expectStatus(post({ departmentId: foreignDepartment.id }), 422)
    assert.equal(errorOf(department).details[0].field, 'departmentId')
    const keys = await expectStatus(
      post({
        requiredDocuments: [
          { key: 'diploma', label: 'Diplôme', required: true },
          { key: 'diploma', label: 'Autre', required: false },
        ],
      }),
      422
    )
    assert.equal(errorOf(keys).details[0].rule, 'distinct')
    await expectStatus(
      post({ requiredDocuments: [{ key: 'Pièce jointe', label: 'x', required: true }] }),
      422
    )
  })

  test('only owner, hr_admin and recruiter manage offers; the module is required', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'])
    const body = { title: 'Comptable', contractType: 'cdi' }
    await expectStatus(orgCall(client, 'POST', '/recruitment/jobs', manager, org).json(body), 403)
    await expectStatus(orgCall(client, 'POST', '/recruitment/jobs', employee, org).json(body), 403)

    const free = await createHrOrganization('Gratuite')
    const owner = await hrSession(client, free, ['owner'])
    const refused = await expectStatus(
      orgCall(client, 'POST', '/recruitment/jobs', owner, free).json(body),
      403
    )
    assert.equal(errorOf(refused).code, 'E_MODULE_NOT_INCLUDED')
  })
})

test.group('GET /org/recruitment/jobs', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('staff see every offer, a manager those of their department', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const recruiter = await hrSession(client, org, ['recruiter'], { linked: false })
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'])
    const sales = await createDepartment(org)
    const finance = await createDepartment(org)
    manager.employee!.departmentId = sales.id
    await manager.employee!.save()
    const salesJob = await createJob(org, { departmentId: sales.id, title: 'Commercial terrain' })
    const financeJob = await createJob(org, { departmentId: finance.id })
    await createJob(await createRecruitingOrganization('Autre'))
    const get = (who: { accessToken: string }, query = '') =>
      expectStatus(orgCall(client, 'GET', `/recruitment/jobs${query}`, who, org), 200)

    assert.sameMembers(ids(await get(recruiter)), [salesJob.id, financeJob.id])
    assert.deepEqual(ids(await get(manager)), [salesJob.id])
    assert.deepEqual(ids(await get(recruiter, '?q=commercial')), [salesJob.id])
    assert.deepEqual(ids(await get(recruiter, `?filter[departmentId]=${finance.id}`)), [
      financeJob.id,
    ])
    await expectStatus(orgCall(client, 'GET', '/recruitment/jobs', employee, org), 403)

    await expectStatus(
      orgCall(client, 'GET', `/recruitment/jobs/${salesJob.id}`, manager, org),
      200
    )
    await expectStatus(
      orgCall(client, 'GET', `/recruitment/jobs/${financeJob.id}`, manager, org),
      403
    )
  })

  test('an offer of another organization is not found', async ({ client }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const foreign = await createJob(await createRecruitingOrganization('Autre'))
    const path = `/recruitment/jobs/${foreign.id}`
    await expectStatus(orgCall(client, 'GET', path, owner, org), 404)
    await expectStatus(orgCall(client, 'PATCH', path, owner, org).json({ title: 'x y' }), 404)
    await expectStatus(orgCall(client, 'POST', `${path}/publish`, owner, org), 404)
    await expectStatus(orgCall(client, 'GET', `${path}/qr`, owner, org), 404)
  })
})

test.group('Job offer lifecycle (07 §4.1)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('publish, close, republish; the slug never follows the title', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const job = await createJob(org, { description: null })
    const path = `/recruitment/jobs/${job.id}`

    const missing = await expectStatus(orgCall(client, 'POST', `${path}/publish`, owner, org), 422)
    assert.equal(errorOf(missing).details[0].field, 'description')
    const renamed = await expectStatus(
      orgCall(client, 'PATCH', path, owner, org).json({
        title: 'Comptable confirmé',
        description: 'Clôtures mensuelles.',
      }),
      200
    )
    assert.equal(renamed.body().data.slug, job.slug)

    await expectStatus(orgCall(client, 'POST', `${path}/close`, owner, org), 409)
    const published = await expectStatus(
      orgCall(client, 'POST', `${path}/publish`, owner, org),
      200
    )
    assert.equal(published.body().data.status, 'published')
    assert.isNotNull(published.body().data.publishedAt)
    await expectStatus(orgCall(client, 'POST', `${path}/publish`, owner, org), 409)
    await expectStatus(orgCall(client, 'PATCH', path, owner, org).json({ description: '' }), 422)
    await expectStatus(orgCall(client, 'POST', `${path}/close`, owner, org), 200)
    await expectStatus(orgCall(client, 'POST', `${path}/publish`, owner, org), 200)
  })

  test('refuses to publish an offer past its deadline', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const job = await createJob(org, { deadline: DateTime.now().minus({ days: 1 }) })
    const response = await expectStatus(
      orgCall(client, 'POST', `/recruitment/jobs/${job.id}/publish`, owner, org),
      422
    )
    assert.equal(errorOf(response).details[0].field, 'deadline')
  })

  test('duplicates as a draft and deletes softly', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const recruiter = await hrSession(client, org, ['recruiter'])
    const source = await createPublishedJob(org, {
      title: 'Chauffeur',
      slug: 'chauffeur',
      viewsCount: 12,
      requiredDocuments: [{ key: 'licence', label: 'Permis', required: true }],
    })

    const copy = await expectStatus(
      orgCall(client, 'POST', `/recruitment/jobs/${source.id}/duplicate`, recruiter, org),
      201
    )
    assert.equal(copy.body().data.slug, 'chauffeur-2')
    assert.equal(copy.body().data.status, 'draft')
    assert.equal(copy.body().data.viewsCount, 0)
    assert.deepEqual(copy.body().data.requiredDocuments, source.requiredDocuments)

    await expectStatus(
      orgCall(client, 'DELETE', `/recruitment/jobs/${source.id}`, recruiter, org),
      204
    )
    const row = await Job.findOrFail(source.id)
    assert.isNotNull(row.deletedAt)
    await expectStatus(
      orgCall(client, 'GET', `/recruitment/jobs/${source.id}`, recruiter, org),
      404
    )
  })

  test('serves the QR code of the public page as a PNG', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const recruiter = await hrSession(client, org, ['recruiter'])
    const manager = await hrSession(client, org, ['manager'])
    const job = await createPublishedJob(org)

    const response = await expectStatus(
      orgCall(client, 'GET', `/recruitment/jobs/${job.id}/qr`, recruiter, org),
      200
    )
    assert.equal(response.header('content-type'), 'image/png')
    await expectStatus(orgCall(client, 'GET', `/recruitment/jobs/${job.id}/qr`, manager, org), 403)
  })
})

test.group('jobs:auto-close', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('closes offers expired for more than 7 days', async ({ assert }) => {
    const org = await createRecruitingOrganization()
    const at = DateTime.fromISO('2026-11-23T00:30:00Z')
    const old = await createPublishedJob(org, { deadline: at.minus({ days: 8 }) })
    const recent = await createPublishedJob(org, { deadline: at.minus({ days: 3 }) })
    const open = await createPublishedJob(org, { deadline: null })

    await jobService.autoClose(at)

    const status = async (job: Job) => {
      const row = await Job.findOrFail(job.id)
      return row.status
    }
    assert.equal(await status(old), 'closed')
    assert.equal(await status(recent), 'published')
    assert.equal(await status(open), 'published')
  })
})
