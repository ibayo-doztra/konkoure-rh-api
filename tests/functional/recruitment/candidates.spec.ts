import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import drive from '@adonisjs/drive/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import Candidate from '#models/candidate'
import CandidateEvent from '#models/candidate_event'
import CandidateNote from '#models/candidate_note'
import Employee from '#models/employee'
import type Job from '#models/job'
import Subscription from '#models/subscription'
import entitlementService from '#modules/billing/services/entitlement_service'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createDepartment, createEmployee, hrSession, orgCall } from '#tests/helpers/hr'
import { createPublishedJob, createRecruitingOrganization } from '#tests/helpers/recruitment'

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'latin1')

let sequence = 0
function createCandidate(job: Job, overrides: Partial<Candidate> = {}) {
  sequence += 1
  return Candidate.create({
    organizationId: job.organizationId,
    jobId: job.id,
    fullName: 'Mamadou Alpha Diallo',
    email: `candidat${sequence}@example.com`,
    phone: `622 10 ${String(sequence % 100).padStart(2, '0')} 00`,
    source: 'careers',
    ...overrides,
  })
}

const ids = (response: { body(): { data: Array<{ id: string }> } }) =>
  response.body().data.map((row) => row.id)

test.group('Candidates: list, add, update, delete', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    drive.fake('s3')
    return () => drive.restore('s3')
  })

  test('the staff lists candidates with filters; others are refused', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const recruiter = await hrSession(client, org, ['recruiter'], { linked: false })
    const manager = await hrSession(client, org, ['manager'])
    const job = await createPublishedJob(org)
    const other = await createPublishedJob(org)
    const first = await createCandidate(job, { fullName: 'Fatoumata Camara' })
    const second = await createCandidate(other, { stage: 'interview' })
    const foreign = await createCandidate(
      await createPublishedJob(await createRecruitingOrganization('Autre'))
    )
    const get = (query = '') =>
      expectStatus(orgCall(client, 'GET', `/recruitment/candidates${query}`, recruiter, org), 200)

    const all = await get()
    assert.sameMembers(ids(all), [first.id, second.id])
    assert.equal(
      all.body().data.find((row: { id: string }) => row.id === first.id).jobTitle,
      job.title
    )
    assert.deepEqual(ids(await get(`?filter[jobId]=${job.id}`)), [first.id])
    assert.deepEqual(ids(await get('?filter[stage]=interview')), [second.id])
    assert.deepEqual(ids(await get('?q=camara')), [first.id])
    await expectStatus(orgCall(client, 'GET', '/recruitment/candidates', manager, org), 403)
    await expectStatus(
      orgCall(client, 'GET', `/recruitment/candidates/${foreign.id}`, recruiter, org),
      404
    )
  })

  test('the staff adds a candidate without the public form', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const recruiter = await hrSession(client, org, ['recruiter'])
    const job = await createPublishedJob(org, {
      requiredDocuments: [{ key: 'diploma', label: 'Diplôme', required: true }],
    })
    const post = () =>
      orgCall(client, 'POST', '/recruitment/candidates', recruiter, org)
        .field('jobId', job.id)
        .field('fullName', 'Ibrahima Bah')
        .field('email', 'ibrahima@example.com')
        .field('source', 'referral')
        .file('cv', PDF, { filename: 'cv.pdf' })

    const created = await expectStatus(post(), 201)
    const body = created.body().data
    assert.equal(body.source, 'referral')
    assert.deepEqual(body.documents, ['cv'])
    assert.isNull(body.aiScore)
    assert.notProperty(body, 'cvPath')
    await expectStatus(post(), 409)
  })

  test('updates, then deletes a candidate for good with its files', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const job = await createPublishedJob(org)
    const taken = await createCandidate(job)
    const candidate = await createCandidate(job, { cvPath: `${org.id}/candidate/x/cv.pdf` })
    await CandidateNote.create({
      organizationId: org.id,
      candidateId: candidate.id,
      authorId: owner.user.id,
      body: 'Bon profil',
    })
    const path = `/recruitment/candidates/${candidate.id}`

    const updated = await expectStatus(
      orgCall(client, 'PATCH', path, owner, org).json({ fullName: 'Mamadou Diallo' }),
      200
    )
    assert.equal(updated.body().data.fullName, 'Mamadou Diallo')
    await expectStatus(orgCall(client, 'PATCH', path, owner, org).json({ email: taken.email }), 409)
    await expectStatus(orgCall(client, 'PATCH', path, owner, org).json({ phone: '62212' }), 422)

    await expectStatus(orgCall(client, 'DELETE', path, owner, org), 204)
    assert.isNull(await Candidate.find(candidate.id))
    assert.lengthOf(await CandidateNote.query().where('candidate_id', candidate.id), 0)
    const [entry] = await AuditLog.query()
      .where('action', 'candidate.deleted')
      .where('target_id', candidate.id)
    assert.notProperty(entry.beforeData ?? {}, 'email')
  })
})

test.group('Candidates: pipeline (07 §4.5)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('forward for the staff, backward for O H only, hired through /hire only', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const recruiter = await hrSession(client, org, ['recruiter'])
    const hr = await hrSession(client, org, ['hr_admin'])
    const job = await createPublishedJob(org)
    const candidate = await createCandidate(job)
    const move = (who: { accessToken: string }, stage: string, reason?: string) =>
      orgCall(client, 'POST', `/recruitment/candidates/${candidate.id}/stage`, who, org).json({
        stage,
        reason,
      })

    await expectStatus(move(recruiter, 'interview'), 200)
    await expectStatus(move(recruiter, 'screening'), 403)
    const same = await expectStatus(move(recruiter, 'interview'), 409)
    assert.equal(errorOf(same).details[0].rule, 'sameStage')
    const hired = await expectStatus(move(recruiter, 'hired'), 422)
    assert.equal(errorOf(hired).details[0].rule, 'hire')
    await expectStatus(move(hr, 'screening'), 200)
    const rejected = await expectStatus(move(recruiter, 'rejected', 'Profil trop junior'), 200)
    assert.equal(rejected.body().data.rejectedReason, 'Profil trop junior')
    await expectStatus(move(recruiter, 'offer'), 403)
    const back = await expectStatus(move(hr, 'offer'), 200)
    assert.isNull(back.body().data.rejectedReason)

    const events = await CandidateEvent.query()
      .where('candidate_id', candidate.id)
      .where('type', 'stage_changed')
    assert.lengthOf(events, 4)
    await expectStatus(move(recruiter, 'bogus'), 422)
  })
})

test.group('Candidates: hiring (07 §4.6)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('creates the employee from the candidate and the offer', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const recruiter = await hrSession(client, org, ['recruiter'])
    const department = await createDepartment(org)
    const job = await createPublishedJob(org, {
      title: 'Comptable senior',
      departmentId: department.id,
    })
    const candidate = await createCandidate(job, { stage: 'offer' })
    const path = `/recruitment/candidates/${candidate.id}/hire`

    const response = await expectStatus(
      orgCall(client, 'POST', path, recruiter, org).json({ hireDate: '2026-12-01' }),
      200
    )
    const { candidate: hired, employeeId } = response.body().data
    assert.equal(hired.stage, 'hired')
    assert.equal(hired.hiredEmployeeId, employeeId)
    const employee = await Employee.findOrFail(employeeId)
    assert.equal(employee.firstName, 'Mamadou')
    assert.equal(employee.lastName, 'Alpha Diallo')
    assert.equal(employee.email, candidate.email)
    assert.equal(employee.jobTitle, 'Comptable senior')
    assert.equal(employee.departmentId, department.id)
    assert.equal(employee.hireDate?.toISODate(), '2026-12-01')
    const reloaded = await job.refresh()
    assert.equal(reloaded.status, 'published')

    await expectStatus(orgCall(client, 'POST', path, recruiter, org).json({}), 409)
    await expectStatus(
      orgCall(client, 'POST', `/recruitment/candidates/${candidate.id}/stage`, recruiter, org).json(
        {
          stage: 'rejected',
        }
      ),
      409
    )
  })

  test('refuses rejected candidates and rolls back over the quota', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const job = await createPublishedJob(org)
    const rejected = await createCandidate(job, { stage: 'rejected' })
    const candidate = await createCandidate(job)
    await expectStatus(
      orgCall(client, 'POST', `/recruitment/candidates/${rejected.id}/hire`, owner, org).json({}),
      409
    )

    await Subscription.query()
      .where('organization_id', org.id)
      .update({ max_employees_override: 1 })
    await entitlementService.invalidate(org.id)
    const refused = await expectStatus(
      orgCall(client, 'POST', `/recruitment/candidates/${candidate.id}/hire`, owner, org).json({}),
      403
    )
    assert.equal(errorOf(refused).code, 'E_QUOTA_EXCEEDED')
    const unchanged = await Candidate.findOrFail(candidate.id)
    assert.equal(unchanged.stage, 'new')
    assert.isNull(unchanged.hiredEmployeeId)
  })

  test('an e-mail already used by an employee is a conflict', async ({ client }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const job = await createPublishedJob(org)
    const candidate = await createCandidate(job)
    await createEmployee(org, { email: candidate.email })
    await expectStatus(
      orgCall(client, 'POST', `/recruitment/candidates/${candidate.id}/hire`, owner, org).json({}),
      409
    )
  })
})

test.group('Candidates: documents, notes, history', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    drive.fake('s3')
    return () => drive.restore('s3')
  })

  test('signed links to stored pieces only, journaled', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const recruiter = await hrSession(client, org, ['recruiter'])
    const job = await createPublishedJob(org)
    const candidate = await createCandidate(job, {
      cvPath: `${org.id}/candidate/c/cv.pdf`,
      documents: { diploma: `${org.id}/candidate/c/diploma.pdf` },
    })
    const url = (key: string) =>
      orgCall(
        client,
        'GET',
        `/recruitment/candidates/${candidate.id}/documents/${key}/url`,
        recruiter,
        org
      )

    const cv = await expectStatus(url('cv'), 200)
    assert.equal(cv.body().data.expiresIn, 900)
    await expectStatus(url('diploma'), 200)
    await expectStatus(url('cover_letter'), 404)
    await expectStatus(url('passport'), 404)
    const views = await AuditLog.query()
      .where('action', 'sensitive_document.viewed')
      .where('target_id', candidate.id)
    assert.lengthOf(views, 2)
  })

  test('notes: the author recruiter or O H delete; events record both', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const author = await hrSession(client, org, ['recruiter'])
    const colleague = await hrSession(client, org, ['recruiter'])
    const hr = await hrSession(client, org, ['hr_admin'])
    const job = await createPublishedJob(org)
    const candidate = await createCandidate(job)
    const base = `/recruitment/candidates/${candidate.id}`

    const created = await expectStatus(
      orgCall(client, 'POST', `${base}/notes`, author, org).json({ body: 'Entretien prometteur' }),
      201
    )
    const second = await expectStatus(
      orgCall(client, 'POST', `${base}/notes`, author, org).json({ body: 'À rappeler' }),
      201
    )
    await expectStatus(
      orgCall(client, 'POST', `${base}/notes`, author, org).json({ body: '' }),
      422
    )
    const list = await expectStatus(orgCall(client, 'GET', `${base}/notes`, colleague, org), 200)
    assert.lengthOf(list.body().data, 2)

    const noteId = created.body().data.id
    await expectStatus(orgCall(client, 'DELETE', `${base}/notes/${noteId}`, colleague, org), 403)
    await expectStatus(orgCall(client, 'DELETE', `${base}/notes/${noteId}`, author, org), 204)
    await expectStatus(
      orgCall(client, 'DELETE', `${base}/notes/${second.body().data.id}`, hr, org),
      204
    )
    await expectStatus(orgCall(client, 'DELETE', `${base}/notes/${noteId}`, hr, org), 404)

    const events = await expectStatus(orgCall(client, 'GET', `${base}/events`, author, org), 200)
    const types = events.body().data.map((row: { type: string }) => row.type)
    assert.sameMembers(types, ['note_added', 'note_added', 'note_deleted', 'note_deleted'])
  })
})

test.group('Candidates: application role', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('hard delete cascades through the insert-only history under RLS', async ({ assert }) => {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const { TenantContext } = await import('#shared/tenant/tenant_context')
    const { default: candidateService } =
      await import('#modules/recruitment/services/candidate_service')
    const { createUser, grantRoles } = await import('#tests/helpers/auth')
    const org = await createRecruitingOrganization()
    const owner = await createUser({ emailVerifiedAt: DateTime.now() })
    await grantRoles(owner, org, ['owner'])
    const job = await createPublishedJob(org)
    const candidate = await createCandidate(job, { stage: 'offer' })
    const other = await createCandidate(job)
    const tenant = new TenantContext(org.id, ['owner'])

    await db.rawQuery('SET LOCAL ROLE konkoure_app')

    await candidateService.addNote(tenant, owner, other.id, 'Note', {})
    await candidateService.stage(tenant, owner, other.id, { stage: 'screening' }, {})
    await candidateService.remove(tenant, other.id, {})
    const { employee } = await candidateService.hire(tenant, owner, candidate.id, {}, {})
    assert.isString(employee.id)
    const { meta } = await candidateService.list(tenant, {})
    assert.equal(meta.total, 1)
  })
})
