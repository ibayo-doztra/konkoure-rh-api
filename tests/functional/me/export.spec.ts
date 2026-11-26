import { test } from '@japa/runner'
import drive from '@adonisjs/drive/services/main'
import mail from '@adonisjs/mail/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import Feedback from '#models/feedback'
import PerformanceReview from '#models/performance_review'
import { PersonalDataExportMail } from '#modules/users/mails/personal_data_export_mail'
import personalDataExportService from '#modules/users/services/personal_data_export_service'
import queueService from '#shared/queue/queue_service'
import { createUser, grantRoles } from '#tests/helpers/auth'
import { expectStatus } from '#tests/helpers/http'
import { createContract, createEmployee, createHrOrganization, hrSession } from '#tests/helpers/hr'
import { createLeave } from '#tests/helpers/leaves'
import { createCycle } from '#tests/helpers/performance'

test.group('GET /api/v1/me/export', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    drive.fake('s3')
    return () => drive.restore('s3')
  })

  test('answers 202, is audited and limited to 1 per hour', async ({ client, assert }) => {
    const dispatched: Array<{ name: string; payload: unknown }> = []
    const original = queueService.dispatch.bind(queueService)
    queueService.dispatch = (async (name: string, payload: unknown) => {
      dispatched.push({ name, payload })
    }) as typeof queueService.dispatch
    try {
      const org = await createHrOrganization()
      const member = await hrSession(client, org, ['employee'])
      const request = () => client.get('/api/v1/me/export').bearerToken(member.accessToken)

      const accepted = await expectStatus(request(), 202)
      const jobId = accepted.body().data.jobId
      assert.isString(jobId)
      await expectStatus(request(), 429)
      assert.deepEqual(dispatched, [
        { name: 'users.export', payload: { exportId: jobId, userId: member.user.id } },
      ])
      const audit = await AuditLog.query()
        .where('action', 'user.exported')
        .where('target_id', member.user.id)
        .firstOrFail()
      assert.isNull(audit.organizationId)
    } finally {
      queueService.dispatch = original
    }
  })

  test('requires authentication', async ({ client }) => {
    await expectStatus(client.get('/api/v1/me/export'), 401)
  })

  test('the job archives the account and the HR data as the employee reads them', async ({
    client,
    assert,
  }) => {
    const { mails } = mail.fake()
    const org = await createHrOrganization('Doztra')
    const other = await createHrOrganization('Autre')
    const manager = await hrSession(client, org, ['manager'])
    const member = await hrSession(client, org, ['employee'], {
      managerId: manager.employee!.id,
    })
    await grantRoles(member.user, other, ['recruiter'])
    // Another person's data of the same organization stays out of the archive.
    const colleagueUser = await createUser()
    const colleague = await createEmployee(org, { userId: colleagueUser.id })
    await createLeave(colleague, { reason: 'Congé du collègue' })

    const employee = member.employee!
    await employee.merge({ baseSalary: '7500000', salaryCurrency: 'GNF' }).save()
    await createContract(employee, { status: 'active', type: 'cdi', salary: '7500000' })
    await createLeave(employee, { reason: 'Mariage' })
    const cycle = await createCycle(org, { status: 'open' })
    await PerformanceReview.create({
      organizationId: org.id,
      employeeId: employee.id,
      managerId: manager.employee!.id,
      cycleId: cycle.id,
      status: 'submitted',
      selfScore: 4,
      managerScore: 2,
      aiSummary: 'Synthèse réservée au manager',
      potentialScore: 3,
    })
    await Feedback.createMany([
      {
        organizationId: org.id,
        toEmployeeId: employee.id,
        fromEmployeeId: manager.employee!.id,
        kind: 'concern',
        message: 'Message privé',
        isPrivate: true,
      },
      {
        organizationId: org.id,
        toEmployeeId: manager.employee!.id,
        fromEmployeeId: employee.id,
        kind: 'kudos',
        message: 'Merci',
      },
    ])

    const key = await personalDataExportService.build({ exportId: 'x', userId: member.user.id })
    assert.isString(key)
    mails.assertQueued(PersonalDataExportMail, (message) =>
      message.message.hasTo(member.user.email)
    )
    const archive = JSON.parse(
      Buffer.from(await drive.use('s3').getBytes(key!)).toString('utf8')
    ) as Record<string, any>
    const text = JSON.stringify(archive)

    assert.equal(archive.user.email, member.user.email)
    assert.notInclude(text, 'passwordHash')
    assert.lengthOf(archive.sessions, 1)
    const byName = new Map(archive.organizations.map((row: any) => [row.name, row]))
    assert.isNull((byName.get('Autre') as any).employee)
    assert.deepEqual((byName.get('Autre') as any).roles, ['recruiter'])

    const hr = (byName.get('Doztra') as any).employee
    assert.equal(hr.profile.id, employee.id)
    assert.equal(hr.profile.baseSalary, 7500000)
    assert.equal(hr.contracts[0].salary, 7500000)
    assert.deepEqual(
      hr.leaveRequests.map((row: any) => row.reason),
      ['Mariage']
    )
    assert.notInclude(text, 'Congé du collègue')
    // Submitted review: the manager's side, the AI synthesis and 9-box scores stay hidden.
    assert.equal(hr.reviews[0].selfScore, 4)
    assert.isNull(hr.reviews[0].managerScore)
    assert.isNull(hr.reviews[0].aiSummary)
    assert.isNull(hr.reviews[0].potentialScore)
    assert.notInclude(text, 'Synthèse réservée')
    assert.isNull(hr.feedbackReceived[0].fromEmployeeId)
    assert.equal(hr.feedbackGiven[0].message, 'Merci')
  })

  test('the job does nothing for a deactivated account', async ({ assert }) => {
    const { mails } = mail.fake()
    const user = await createUser({ isActive: false })
    assert.isNull(await personalDataExportService.build({ exportId: 'x', userId: user.id }))
    mails.assertNoneQueued()
  })
})
