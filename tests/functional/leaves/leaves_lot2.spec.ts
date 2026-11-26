import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import drive from '@adonisjs/drive/services/main'
import mail from '@adonisjs/mail/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import Employee from '#models/employee'
import LeaveBalance from '#models/leave_balance'
import StoredFile from '#models/stored_file'
import { LeaveDecidedMail, LeaveRequestedMail } from '#modules/leaves/mails/leave_mails'
import leaveScheduleService from '#modules/leaves/services/leave_schedule_service'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import {
  YEAR,
  balanceOf,
  createHoliday,
  createLeave,
  displayed,
  iso,
  ledgerSum,
  monday,
  week,
} from '#tests/helpers/leaves'

const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'latin1')

/** An instant of `YEAR` in Guinea, for the scheduled tasks. */
const at = (isoDate: string, time = '00:30') =>
  DateTime.fromISO(`${isoDate}T${time}`, { zone: 'Africa/Conakry' })

test.group('GET /org/leaves/calendar', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('lists the visible leaves and the holidays of the period', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const start = monday()
    const range = { startDate: start, endDate: start.plus({ days: 4 }) }
    const team = await createLeave(report.employee!, range)
    const own = await createLeave(manager.employee!, { ...range, status: 'approved' })
    await createLeave(await createEmployee(org), range)
    await createLeave(report.employee!, {
      startDate: start.plus({ weeks: 1 }),
      endDate: start.plus({ weeks: 1 }),
      status: 'rejected',
    })
    await createLeave(await createEmployee(other), range)
    await createHoliday(org, start.plus({ days: 2 }), 'Fête')
    const period = `from=${iso(start)}&to=${iso(start.plus({ days: 13 }))}`
    const get = (who: typeof manager) =>
      expectStatus(orgCall(client, 'GET', `/leaves/calendar?${period}`, who, org), 200)

    const managed = await get(manager)
    const seen = managed.body().data
    assert.sameMembers(
      seen.leaves.map((row: { id: string }) => row.id),
      [team.id, own.id]
    )
    const row = seen.leaves.find((leave: { id: string }) => leave.id === team.id)
    assert.equal(row.employeeName, `${report.employee!.firstName} ${report.employee!.lastName}`)
    assert.deepEqual(
      seen.holidays.map((holiday: { name: string; date: string }) => [holiday.name, holiday.date]),
      [['Fête', iso(start.plus({ days: 2 }))]]
    )
    const reportView = await get(report)
    const mine = reportView.body().data
    assert.deepEqual(
      mine.leaves.map((leave: { id: string }) => leave.id),
      [team.id]
    )
  })

  test('limits the window to 92 days and defaults to a month', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const call = (query: string) => orgCall(client, 'GET', `/leaves/calendar${query}`, owner, org)

    const wide = await expectStatus(call(`?from=${YEAR}-01-01&to=${YEAR}-06-30`), 422)
    assert.equal(errorOf(wide).details[0].rule, 'maxRange')
    await expectStatus(call(`?from=${YEAR}-03-10&to=${YEAR}-03-01`), 422)
    const month = await expectStatus(call(`?from=${YEAR}-02-10`), 200)
    assert.include(month.body().data, { from: `${YEAR}-02-10`, to: `${YEAR}-02-28` })
  })
})

test.group('GET /org/employees/:id/leave-balance', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('self, team manager and HR read it; 404 across tenants', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const hr = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const peer = await hrSession(client, org, ['employee'])
    await expectStatus(
      orgCall(client, 'POST', '/leaves', report, org).json({ type: 'annual', ...week() }),
      201
    )
    const path = `/employees/${report.employee!.id}/leave-balance?year=${YEAR}`

    for (const who of [report, manager, hr]) {
      const response = await expectStatus(orgCall(client, 'GET', path, who, org), 200)
      assert.deepInclude(response.body().data[0], { leaveType: 'annual', pendingDays: 5 })
    }
    await expectStatus(orgCall(client, 'GET', path, peer, org), 403)
    const foreign = await createEmployee(other)
    await expectStatus(
      orgCall(client, 'GET', `/employees/${foreign.id}/leave-balance`, hr, org),
      404
    )
  })
})

test.group('Leave attachment', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    drive.fake('s3')
    return () => drive.restore('s3')
  })

  test('the author attaches a document while pending; viewers get a signed link', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'], {
      managerId: manager.employee!.id,
    })
    const peer = await hrSession(client, org, ['employee'])
    const created = await expectStatus(
      orgCall(client, 'POST', '/leaves', employee, org).json({ type: 'sick', ...week() }),
      201
    )
    const id = created.body().data.id
    const upload = (who: typeof hr, content: Buffer, filename = 'certificat.pdf') =>
      orgCall(client, 'POST', `/leaves/${id}/attachment`, who, org).file('file', content, {
        filename,
      })

    await expectStatus(orgCall(client, 'GET', `/leaves/${id}/attachment`, employee, org), 404)
    const bad = await expectStatus(upload(employee, Buffer.from('bonjour'), 'note.pdf'), 422)
    assert.equal(errorOf(bad).details[0].rule, 'documentType')
    await expectStatus(upload(peer, PDF), 403)
    const uploaded = await expectStatus(upload(employee, PDF), 200)
    assert.isTrue(uploaded.body().data.hasAttachment)
    assert.notProperty(uploaded.body().data, 'attachmentPath')

    const link = await expectStatus(
      orgCall(client, 'GET', `/leaves/${id}/attachment`, manager, org),
      200
    )
    assert.equal(link.body().data.expiresIn, 900)
    await expectStatus(orgCall(client, 'GET', `/leaves/${id}/attachment`, peer, org), 403)

    await expectStatus(orgCall(client, 'POST', `/leaves/${id}/approve`, manager, org), 200)
    await expectStatus(upload(employee, PDF), 403)
    await expectStatus(upload(hr, PDF), 200)

    // The registry keeps only the current document, the replaced one is gone.
    const rows = await StoredFile.query()
      .where('owner_type', 'leave_attachment')
      .where('owner_id', id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].organizationId, org.id)
    assert.equal(rows[0].bucket, 'private-docs')
    assert.equal(rows[0].uploadedBy, hr.user.id)
    assert.isTrue(await drive.use('s3').exists(rows[0].path))
  })
})

test.group('Leave e-mails', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('a request goes to the direct manager, the decision to the employee', async ({ client }) => {
    const { mails } = mail.fake()
    const org = await createHrOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'], {
      managerId: manager.employee!.id,
    })
    await hrSession(client, org, ['hr_admin'])

    const created = await expectStatus(
      orgCall(client, 'POST', '/leaves', employee, org).json({ type: 'annual', ...week() }),
      201
    )
    mails.assertQueuedCount(LeaveRequestedMail, 1)
    mails.assertQueued(LeaveRequestedMail, (message) => message.message.hasTo(manager.user.email))

    await expectStatus(
      orgCall(client, 'POST', `/leaves/${created.body().data.id}/reject`, manager, org).json({
        decisionComment: 'Inventaire annuel',
      }),
      200
    )
    mails.assertQueued(LeaveDecidedMail, (message) => message.message.hasTo(employee.user.email))
  })

  test('without a manager it goes to hr_admin, never to the author', async ({ client }) => {
    const { mails } = mail.fake()
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const hr = await hrSession(client, org, ['hr_admin'])
    const employee = await hrSession(client, org, ['employee'])

    await expectStatus(
      orgCall(client, 'POST', '/leaves', employee, org).json({ type: 'annual', ...week() }),
      201
    )
    mails.assertQueuedCount(LeaveRequestedMail, 1)
    mails.assertQueued(LeaveRequestedMail, (message) => message.message.hasTo(hr.user.email))

    // hr_admin requests for themselves: the owners are told, not the author.
    const own = await expectStatus(
      orgCall(client, 'POST', '/leaves', hr, org).json({ type: 'annual', ...week(2) }),
      201
    )
    mails.assertQueued(LeaveRequestedMail, (message) => message.message.hasTo(owner.user.email))
    mails.assertQueuedCount(LeaveRequestedMail, 2)

    // The owner decides on a leave they requested for the employee: the employee is told.
    await expectStatus(
      orgCall(client, 'POST', `/leaves/${own.body().data.id}/approve`, owner, org),
      200
    )
    mails.assertQueued(LeaveDecidedMail, (message) => message.message.hasTo(hr.user.email))
  })
})

test.group('Scheduled leave tasks', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('apply-started and end follow approved leaves only', async ({ assert }) => {
    const org = await createHrOrganization()
    const away = await createEmployee(org)
    const back = await createEmployee(org, { status: 'on_leave' })
    const manual = await createEmployee(org, { status: 'on_leave' })
    const pending = await createEmployee(org)
    const today = monday(2)
    await createLeave(away, {
      status: 'approved',
      startDate: today.minus({ days: 1 }),
      endDate: today.plus({ days: 2 }),
    })
    await createLeave(back, {
      status: 'approved',
      startDate: today.minus({ days: 5 }),
      endDate: today.minus({ days: 1 }),
    })
    await createLeave(pending, { startDate: today, endDate: today })
    const status = async (employee: Employee) => {
      const row = await Employee.findOrFail(employee.id)
      return row.status
    }

    assert.equal(await leaveScheduleService.run('apply-started', at(iso(today), '00:05')), 1)
    assert.equal(await status(away), 'on_leave')
    assert.equal(await status(pending), 'active')
    assert.equal(await leaveScheduleService.run('apply-started', at(iso(today), '00:05')), 0)

    assert.equal(await leaveScheduleService.run('end', at(iso(today), '00:10')), 1)
    assert.equal(await status(back), 'active')
    assert.equal(await status(manual), 'on_leave')
    assert.equal(await status(away), 'on_leave')
  })

  test('annual rollover carries at most the ceiling, never a debt, once', async ({ assert }) => {
    const org = await createHrOrganization()
    const saver = await createEmployee(org)
    const spender = await createEmployee(org)
    const modest = await createEmployee(org)
    const previous = (employee: Employee, taken: string) =>
      LeaveBalance.create({
        organizationId: org.id,
        employeeId: employee.id,
        year: YEAR - 1,
        leaveType: 'annual',
        entitledDays: '30.00',
        carriedOverDays: '0.00',
        takenDays: taken,
        pendingDays: '0.00',
      })
    await previous(saver, '5.00')
    await previous(spender, '33.00')
    await previous(modest, '26.50')
    const newYear = at(`${YEAR}-01-01`)

    assert.equal(await leaveScheduleService.run('annual-rollover', newYear), 3)
    assert.equal(await leaveScheduleService.run('annual-rollover', newYear), 0)

    const carried = async (employee: Employee) => {
      const row = await balanceOf(employee, 'annual', YEAR)
      return Number(row.carriedOverDays)
    }
    assert.equal(await carried(saver), 10)
    assert.equal(await carried(spender), 0)
    assert.equal(await carried(modest), 3.5)
    const balance = await balanceOf(saver, 'annual', YEAR)
    assert.equal(displayed(balance), 40)
    assert.equal(await ledgerSum(saver, 'annual', YEAR), 40)
  })
})
