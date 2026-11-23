import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import drive from '@adonisjs/drive/services/main'
import mail from '@adonisjs/mail/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import type { ApiClient } from '@japa/api-client'
import Candidate from '#models/candidate'
import CandidateEvent from '#models/candidate_event'
import Notification from '#models/notification'
import type Organization from '#models/organization'
import StoredFile from '#models/stored_file'
import {
  ApplicationReceivedMail,
  CandidateAppliedMail,
} from '#modules/recruitment/mails/application_mails'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createHrOrganization, hrSession } from '#tests/helpers/hr'
import {
  createJob,
  createPublishedJob,
  createRecruitingOrganization,
} from '#tests/helpers/recruitment'

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'latin1')
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
])
const DOCX = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from('....[Content_Types].xml....word/document.xml....', 'latin1'),
])

function apply(
  client: ApiClient,
  organization: Organization,
  jobSlug: string,
  fields: Record<string, string> = {},
  files: Record<string, Buffer | null> = {}
) {
  const request = client.post(`/api/v1/public/careers/${organization.slug}/jobs/${jobSlug}/apply`)
  const values = {
    fullName: 'Mariama Sow',
    email: 'mariama@example.com',
    phone: '622 12 34 56',
    ...fields,
  }
  for (const [name, value] of Object.entries(values)) request.field(name, value)
  const pieces = { cv: PDF, ...files }
  for (const [name, content] of Object.entries(pieces)) {
    if (content) request.file(name, content, { filename: `${name}.bin` })
  }
  return request
}

test.group('POST /public/careers/:orgSlug/jobs/:jobSlug/apply', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    drive.fake('s3')
    return () => drive.restore('s3')
  })

  test('stores the application, its pieces, and tells recruiters and candidate', async ({
    client,
    assert,
  }) => {
    const { mails } = mail.fake()
    const org = await createRecruitingOrganization()
    const recruiter = await hrSession(client, org, ['recruiter'], { linked: false })
    const job = await createPublishedJob(org, {
      requiredDocuments: [
        { key: 'diploma', label: 'Diplôme', required: true },
        { key: 'licence', label: 'Permis', required: false },
      ],
    })

    const response = await expectStatus(
      apply(client, org, job.slug, {}, { 'coverLetter': DOCX, 'documents[diploma]': PNG }),
      201
    )
    const { candidateId, message } = response.body().data
    assert.isString(message)
    const candidate = await Candidate.findOrFail(candidateId)
    assert.equal(candidate.source, 'careers')
    assert.equal(candidate.phone, '622 12 34 56')
    assert.equal(candidate.stage, 'new')
    assert.isNotNull(candidate.cvPath)
    assert.isNotNull(candidate.coverLetterPath)
    assert.deepEqual(Object.keys(candidate.documents), ['diploma'])
    const files = await StoredFile.query().where('owner_id', candidateId)
    assert.lengthOf(files, 3)
    const [event] = await CandidateEvent.query().where('candidate_id', candidateId)
    assert.equal(event.type, 'created')

    mails.assertQueued(CandidateAppliedMail, (m) => m.message.hasTo(recruiter.user.email))
    mails.assertQueued(ApplicationReceivedMail, (m) => m.message.hasTo('mariama@example.com'))
    const [notice] = await Notification.query()
      .where('organization_id', org.id)
      .where('type', 'candidate.applied')
    assert.equal(notice.userId, recruiter.user.id)
  })

  test('refuses any phone that is not NNN NN NN NN', async ({ client }) => {
    const org = await createRecruitingOrganization()
    const job = await createPublishedJob(org)
    for (const phone of [
      '622 12 34 5',
      '622 12 34 567',
      '622-12-34-56',
      '622123456',
      '+224 622 12 34 56',
    ]) {
      await expectStatus(apply(client, org, job.slug, { phone }), 422)
    }
  })

  test('refuses a duplicate by e-mail or phone before storing anything', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const job = await createPublishedJob(org)
    await expectStatus(apply(client, org, job.slug), 201)
    const files = await StoredFile.query().where('organization_id', org.id)

    const byEmail = await expectStatus(
      apply(client, org, job.slug, { email: 'MARIAMA@example.com', phone: '622 99 99 99' }),
      409
    )
    assert.equal(errorOf(byEmail).details[0].rule, 'already_applied')
    await expectStatus(
      apply(client, org, job.slug, { email: 'autre@example.com', phone: '622 12 34 56' }),
      409
    )
    const after = await StoredFile.query().where('organization_id', org.id)
    assert.lengthOf(after, files.length)

    const other = await createPublishedJob(org)
    await expectStatus(apply(client, org, other.slug), 201)
  })

  test('the pre-check answers before any file is sent', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const job = await createPublishedJob(org)
    const check = (email: string, phone: string) =>
      client
        .post(`/api/v1/public/careers/${org.slug}/jobs/${job.slug}/apply/check`)
        .json({ email, phone })

    const free = await expectStatus(check('mariama@example.com', '622 12 34 56'), 200)
    assert.isTrue(free.body().data.available)
    await expectStatus(apply(client, org, job.slug), 201)
    await expectStatus(check('mariama@example.com', '622 00 00 00'), 409)
    await expectStatus(check('x@example.com', '622 12 34 56'), 409)
    await expectStatus(check('x@example.com', '62212'), 422)
  })

  test('checks the pieces: CV, required documents, real type, size', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const job = await createPublishedJob(org, {
      requiredDocuments: [{ key: 'diploma', label: 'Diplôme', required: true }],
    })
    const withDiploma = { 'documents[diploma]': PDF }
    let attempt = 0
    // A distinct applicant per attempt: the e-mail budget (3 / hour) is not under test here.
    const send = (files: Record<string, Buffer | null>) => {
      attempt += 1
      return apply(
        client,
        org,
        job.slug,
        {
          email: `piece${attempt}@example.com`,
          phone: `622 00 00 ${String(attempt).padStart(2, '0')}`,
        },
        files
      )
    }

    await expectStatus(send({ cv: null, ...withDiploma }), 422)
    const missing = await expectStatus(send({}), 422)
    assert.equal(errorOf(missing).details[0].field, 'documents.diploma')
    await expectStatus(send({ ...withDiploma, 'documents[passport]': PDF }), 422)
    const fake = await expectStatus(
      send({ cv: Buffer.from('MZ fake executable'), ...withDiploma }),
      422
    )
    assert.equal(errorOf(fake).details[0].field, 'cv')
    await limiter.clear(['memory'])
    await expectStatus(
      send({ cv: Buffer.concat([PDF, Buffer.alloc(2 * 1024 * 1024)]), ...withDiploma }),
      413
    )
    assert.lengthOf(await Candidate.query().where('job_id', job.id), 0)
  })

  test('closed or expired offers answer 410, drafts and unknown 404', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const closed = await createPublishedJob(org, { status: 'closed' })
    const expired = await createPublishedJob(org, { deadline: DateTime.now().minus({ hours: 1 }) })
    const draft = await createJob(org)
    const free = await createHrOrganization('Gratuite')
    const elsewhere = await createPublishedJob(free)

    const gone = await expectStatus(apply(client, org, closed.slug), 410)
    assert.equal(errorOf(gone).code, 'E_JOB_CLOSED')
    await expectStatus(
      apply(client, org, expired.slug, { email: 'b@example.com', phone: '622 00 00 01' }),
      410
    )
    await expectStatus(
      apply(client, org, draft.slug, { email: 'c@example.com', phone: '622 00 00 02' }),
      404
    )
    await expectStatus(
      apply(client, free, elsewhere.slug, { email: 'd@example.com', phone: '622 00 00 03' }),
      404
    )
  })

  test('a filled honeypot is refused; the e-mail budget is 3 per hour', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization()
    const job = await createPublishedJob(org)
    await expectStatus(apply(client, org, job.slug, { website: 'http://spam.example' }), 422)

    // Attempts that reach the service count, refused duplicates included.
    await expectStatus(apply(client, org, job.slug), 201)
    await expectStatus(apply(client, org, job.slug), 409)
    await expectStatus(apply(client, org, job.slug), 409)
    const limited = await expectStatus(apply(client, org, job.slug), 429)
    assert.equal(errorOf(limited).code, 'E_RATE_LIMITED')
  })
})
