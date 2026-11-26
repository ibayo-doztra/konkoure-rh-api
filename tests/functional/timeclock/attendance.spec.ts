import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import ExcelJS from 'exceljs'
import drive from '@adonisjs/drive/services/main'
import mail from '@adonisjs/mail/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import redis from '@adonisjs/redis/services/main'
import AttendanceDay from '#models/attendance_day'
import AuditLog from '#models/audit_log'
import type Employee from '#models/employee'
import StoredFile from '#models/stored_file'
import { TimeLogsExportMail } from '#modules/timeclock/mails/time_logs_export_mail'
import timeLogExportService, {
  EXPORT_LIMITS,
  type TimeLogExportJob,
} from '#modules/timeclock/services/time_log_export_service'
import queueService from '#shared/queue/queue_service'
import attendanceService from '#modules/timeclock/services/attendance_service'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { createHoliday, createLeave } from '#tests/helpers/leaves'
import { createPunch, setTimeclockSettings } from '#tests/helpers/timeclock'

type Session = Awaited<ReturnType<typeof hrSession>>

const ZONE = 'Africa/Conakry'
/** A past day, closed. */
const DAY = '2026-11-10'
const on = (time: string, day = DAY) => DateTime.fromISO(`${day}T${time}`, { zone: ZONE })
const today = () => DateTime.now().setZone(ZONE).toISODate()!

function dayOf(employee: Employee, day = DAY) {
  return AttendanceDay.query().where('employee_id', employee.id).where('day', day).first()
}

async function workedDay(employee: Employee, day = DAY) {
  await createPunch(employee, { type: 'in', punchedAt: on('08:00', day) })
  await createPunch(employee, { type: 'out', punchedAt: on('16:30', day) })
  await attendanceService.recompute(employee.organizationId, employee.id, day)
}

test.group('attendance_days recompute (07 §2.8)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('a punch recomputes its day after the commit', async ({ client, assert }) => {
    const org = await createHrOrganization()
    await setTimeclockSettings(org, { requireZone: false })
    const me = await hrSession(client, org, ['employee'])
    const punchedAt = DateTime.now().minus({ seconds: 1 })

    await expectStatus(
      orgCall(client, 'POST', '/timeclock/punch', me, org).json({ punchedAt: punchedAt.toISO() }),
      201
    )
    const day = await dayOf(me.employee!, punchedAt.setZone(ZONE).toISODate()!)
    assert.exists(day)
    assert.equal(day!.punchCount, 1)
    assert.isFalse(day!.isComplete)
    assert.equal(day!.firstIn?.toMillis(), DateTime.fromISO(punchedAt.toISO()!).toMillis())
  })

  test('a past day with an open pair is missing_out; recompute is idempotent', async ({
    assert,
  }) => {
    const org = await createHrOrganization()
    const worker = await createEmployee(org)
    await createPunch(worker, { type: 'in', punchedAt: on('08:00'), anomaly: 'out_of_zone' })

    await attendanceService.recompute(org.id, worker.id, DAY)
    await attendanceService.recompute(org.id, worker.id, DAY)
    const rows = await AttendanceDay.query().where('employee_id', worker.id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].anomaly, 'missing_out')
    assert.equal(rows[0].organizationId, org.id)
  })

  test('a correction recomputes both days, a deletion removes the empty day', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const worker = await createEmployee(org)
    const log = await createPunch(worker, { type: 'in', punchedAt: on('08:00') })
    await attendanceService.recompute(org.id, worker.id, DAY)

    const next = '2026-11-11'
    await expectStatus(
      orgCall(client, 'PATCH', `/timeclock/logs/${log.id}`, hr, org).json({
        punchedAt: on('08:05', next).toISO(),
      }),
      200
    )
    assert.isNull(await dayOf(worker))
    assert.equal((await dayOf(worker, next))!.punchCount, 1)

    await expectStatus(orgCall(client, 'DELETE', `/timeclock/logs/${log.id}`, hr, org), 204)
    assert.isNull(await dayOf(worker, next))
  })

  test('consolidate drains the dirty set', async ({ assert }) => {
    const org = await createHrOrganization()
    const worker = await createEmployee(org)
    await createPunch(worker, { type: 'in', punchedAt: on('08:00') })
    await createPunch(worker, { type: 'out', punchedAt: on('12:00') })
    const cache = redis.connection('cache')
    await cache.del('attendance:dirty')
    await cache.sadd('attendance:dirty', `${org.id}|${worker.id}|${DAY}`)

    assert.equal(await attendanceService.consolidate(), 1)
    assert.equal((await dayOf(worker))!.workedMinutes, 240)
    assert.equal(await cache.scard('attendance:dirty'), 0)
  })

  test('close-day turns the open pairs of today into missing_out', async ({ assert }) => {
    const org = await createHrOrganization()
    const worker = await createEmployee(org)
    const done = await createEmployee(org)
    const now = DateTime.now()
    await createPunch(worker, { type: 'in', punchedAt: now.minus({ seconds: 1 }) })
    await attendanceService.recompute(org.id, worker.id, today())
    assert.isNull((await dayOf(worker, today()))!.anomaly)
    await workedDay(done)

    await attendanceService.closeDay(now)
    assert.equal((await dayOf(worker, today()))!.anomaly, 'missing_out')
    assert.isNull((await dayOf(done))!.anomaly)
  })
})

test.group('GET /org/timeclock/attendance', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('lists by role and hides other tenants', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const agent = await hrSession(client, org, ['security_agent'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const recruiter = await hrSession(client, org, ['recruiter'])
    const unrelated = await createEmployee(org)
    for (const employee of [report.employee!, manager.employee!, unrelated]) {
      await workedDay(employee)
    }
    await workedDay(await createEmployee(other))
    const period = `?filter[from]=${DAY}&filter[to]=${DAY}`
    const ids = async (who: Session, query = period) => {
      const response = await expectStatus(
        orgCall(client, 'GET', `/timeclock/attendance${query}`, who, org),
        200
      )
      return response.body().data.map((row: { employeeId: string }) => row.employeeId)
    }

    const all = [report.employee!.id, manager.employee!.id, unrelated.id]
    assert.sameMembers(await ids(owner), all)
    assert.sameMembers(await ids(agent), all)
    assert.sameMembers(await ids(manager), [report.employee!.id, manager.employee!.id])
    assert.deepEqual(await ids(report), [report.employee!.id])
    await expectStatus(orgCall(client, 'GET', '/timeclock/attendance', recruiter, org), 403)

    const response = await expectStatus(
      orgCall(client, 'GET', `/timeclock/attendance${period}`, report, org),
      200
    )
    const [row] = response.body().data
    assert.equal(DateTime.fromISO(row.firstIn).toMillis(), on('08:00').toMillis())
    assert.equal(DateTime.fromISO(row.lastOut).toMillis(), on('16:30').toMillis())
    assert.deepInclude(row, {
      employeeId: report.employee!.id,
      day: DAY,
      workedMinutes: 510,
      punchCount: 2,
      isComplete: true,
      anomaly: null,
    })
    assert.equal(response.body().meta.total, 1)
  })

  test('validates the period and the filters', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const call = (query: string) =>
      orgCall(client, 'GET', `/timeclock/attendance${query}`, owner, org)

    const tooLong = await expectStatus(call('?filter[from]=2026-01-01&filter[to]=2026-06-01'), 422)
    assert.equal(errorOf(tooLong).details[0].rule, 'range')
    await expectStatus(call('?filter[from]=2026-11-10&filter[to]=2026-11-01'), 422)
    await expectStatus(call('?filter[anomaly]=early'), 422)
    await expectStatus(call('?filter[from]=10/11/2026'), 422)
    await expectStatus(call(''), 200)
  })
})

test.group('GET /org/timeclock/today', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('splits the staff in present, on leave and absent', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const hr = await hrSession(client, org, ['hr_admin'], { linked: false })
    const present = await createEmployee(org, { firstName: 'Awa', lastName: 'Bah' })
    const absent = await createEmployee(org, { firstName: 'Ibrahima', lastName: 'Camara' })
    const away = await createEmployee(org, { lastName: 'Diallo' })
    const statusAway = await createEmployee(org, { lastName: 'Sow', status: 'on_leave' })
    await createEmployee(org, { status: 'terminated' })
    const now = DateTime.now().setZone(ZONE)
    await createLeave(away, {
      status: 'approved',
      startDate: now.startOf('day'),
      endDate: now.startOf('day'),
      requestedDays: '1.00',
    })
    await createPunch(present, { type: 'in', punchedAt: now.minus({ seconds: 1 }) })
    await attendanceService.recompute(org.id, present.id, today())
    const foreign = await createEmployee(other)
    await createPunch(foreign, { type: 'in', punchedAt: now.minus({ seconds: 1 }) })
    await attendanceService.recompute(other.id, foreign.id, today())

    const response = await expectStatus(orgCall(client, 'GET', '/timeclock/today', hr, org), 200)
    const board = response.body().data
    assert.equal(board.date, today())
    assert.isFalse(board.isHoliday)
    assert.deepEqual(board.counts, { total: 4, present: 1, absent: 1, onLeave: 2 })
    assert.deepInclude(board.present[0], { employeeId: present.id, fullName: 'Awa Bah' })
    assert.deepEqual(board.absent, [
      { employeeId: absent.id, fullName: 'Ibrahima Camara', departmentId: null },
    ])
    assert.sameMembers(
      board.onLeave.map((row: { employeeId: string }) => row.employeeId),
      [away.id, statusAway.id]
    )
  })

  test('flags holidays, scopes managers to their team, refuses employees', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    await createEmployee(org)
    await createHoliday(org, DateTime.now().setZone(ZONE).startOf('day'))

    const response = await expectStatus(
      orgCall(client, 'GET', '/timeclock/today', manager, org),
      200
    )
    assert.isTrue(response.body().data.isHoliday)
    assert.sameMembers(
      response.body().data.absent.map((row: { employeeId: string }) => row.employeeId),
      [manager.employee!.id, report.employee!.id]
    )
    await expectStatus(orgCall(client, 'GET', '/timeclock/today', report, org), 403)
  })
})

test.group('POST /org/timeclock/logs/export', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    drive.fake('s3')
    return () => drive.restore('s3')
  })

  const period = (from: string, to: string) => ({
    from: on('00:00', from).toISO(),
    to: on('23:59', to).toISO(),
  })

  /** Captures the queued exports instead of running them. */
  function captureDispatch() {
    const dispatched: Array<{ name: string; payload: TimeLogExportJob }> = []
    const original = queueService.dispatch.bind(queueService)
    queueService.dispatch = (async (name: string, payload: TimeLogExportJob) => {
      dispatched.push({ name, payload })
    }) as typeof queueService.dispatch
    return {
      dispatched,
      restore: () => {
        queueService.dispatch = original
      },
    }
  }

  test('answers 202, audited, limited to 5 per hour and reserved to HR', async ({
    client,
    assert,
    cleanup,
  }) => {
    const { dispatched, restore } = captureDispatch()
    cleanup(restore)
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const agent = await hrSession(client, org, ['security_agent'])
    const employee = await hrSession(client, org, ['employee'])
    const worker = await createEmployee(org)
    await createPunch(worker, { punchedAt: on('08:00') })
    const request = (who: Session) =>
      orgCall(client, 'POST', '/timeclock/logs/export', who, org).json({
        format: 'csv',
        filter: { ...period(DAY, DAY), employeeId: worker.id },
      })

    for (const who of [manager, agent, employee]) await expectStatus(request(who), 403)
    const accepted = await expectStatus(request(hr), 202)
    assert.isString(accepted.body().data.jobId)
    assert.equal(dispatched[0].name, 'time-logs.export')
    assert.deepInclude(dispatched[0].payload, {
      exportId: accepted.body().data.jobId,
      organizationId: org.id,
      userId: hr.user.id,
      format: 'csv',
    })
    assert.equal(dispatched[0].payload.filters.employeeId, worker.id)
    const audit = await AuditLog.query()
      .where('organization_id', org.id)
      .where('action', 'time_log.exported')
      .firstOrFail()
    assert.equal((audit.afterData as { rows: number }).rows, 1)

    for (let index = 0; index < 4; index += 1) await expectStatus(request(hr), 202)
    await expectStatus(request(hr), 429)
    assert.lengthOf(dispatched, 5)
  })

  test('validates the format, the period and the size', async ({ client, assert, cleanup }) => {
    const { dispatched, restore } = captureDispatch()
    cleanup(restore)
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const call = (body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/timeclock/logs/export', owner, org).json(body)

    await expectStatus(call({ format: 'pdf', filter: period(DAY, DAY) }), 422)
    await expectStatus(call({ format: 'csv' }), 422)
    const tooLong = await expectStatus(
      call({ format: 'csv', filter: period('2025-11-01', DAY) }),
      422
    )
    assert.equal(errorOf(tooLong).details[0].rule, 'range')
    await expectStatus(call({ format: 'xlsx', filter: period('2025-11-10', DAY) }), 202)

    const worker = await createEmployee(org)
    await createPunch(worker, { type: 'in', punchedAt: on('08:00') })
    await createPunch(worker, { type: 'out', punchedAt: on('17:00') })
    const { maxRows } = EXPORT_LIMITS
    EXPORT_LIMITS.maxRows = 1
    cleanup(() => {
      EXPORT_LIMITS.maxRows = maxRows
    })
    const tooLarge = await expectStatus(call({ format: 'csv', filter: period(DAY, DAY) }), 422)
    assert.equal(errorOf(tooLarge).details[0].rule, 'tooManyRows')
    assert.lengthOf(dispatched, 1)
  })

  test('the job writes a CSV of the organization and e-mails a link', async ({
    client,
    assert,
  }) => {
    const { mails } = mail.fake()
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const hr = await hrSession(client, org, ['hr_admin'])
    const worker = await createEmployee(org, {
      firstName: 'Mariama',
      lastName: 'Diallo',
      employeeNumber: 'K-001',
    })
    await createPunch(worker, { type: 'in', punchedAt: on('08:02'), anomaly: 'out_of_zone' })
    await createPunch(worker, { type: 'out', punchedAt: on('17:00'), notes: '=SUM(A1)' })
    await createPunch(await createEmployee(other), { punchedAt: on('09:00') })

    const rows = await timeLogExportService.build({
      exportId: 'test',
      organizationId: org.id,
      userId: hr.user.id,
      format: 'csv',
      filters: { from: on('00:00').toISO()!, to: on('23:59').toISO()! },
    })
    assert.equal(rows, 2)
    mails.assertQueued(TimeLogsExportMail, (message) => message.message.hasTo(hr.user.email))

    const file = await StoredFile.query()
      .where('owner_type', 'time_log_export')
      .where('owner_id', hr.user.id)
      .firstOrFail()
    assert.equal(file.organizationId, org.id)
    const text = Buffer.from(await drive.use('s3').getBytes(file.path)).toString('utf8')
    // trim() also drops the BOM.
    assert.deepEqual(text.trim().split('\r\n'), [
      'Matricule;Nom;Prénom;Type;Date;Heure;Source;Zone;Dans la zone;Anomalie;Notes',
      `K-001;Diallo;Mariama;in;${DAY};08:02:00;nfc;;non;out_of_zone;`,
      `K-001;Diallo;Mariama;out;${DAY};17:00:00;nfc;;non;;'=SUM(A1)`,
    ])
  })

  test('XLSX in the language of the requester, read page by page', async ({
    client,
    assert,
    cleanup,
  }) => {
    mail.fake()
    const { pageSize } = EXPORT_LIMITS
    EXPORT_LIMITS.pageSize = 2
    cleanup(() => {
      EXPORT_LIMITS.pageSize = pageSize
    })
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    hr.user.merge({ preferredLanguage: 'en' })
    await hr.user.save()
    const worker = await createEmployee(org)
    for (let minute = 0; minute < 5; minute += 1) {
      await createPunch(worker, { type: 'in', punchedAt: on(`08:0${minute}`) })
    }

    const rows = await timeLogExportService.build({
      exportId: 'test',
      organizationId: org.id,
      userId: hr.user.id,
      format: 'xlsx',
      filters: { from: on('00:00').toISO()!, to: on('23:59').toISO()! },
    })
    assert.equal(rows, 5)
    const file = await StoredFile.query()
      .where('owner_type', 'time_log_export')
      .where('owner_id', hr.user.id)
      .firstOrFail()
    const workbook = new ExcelJS.Workbook()
    const bytes = await drive.use('s3').getBytes(file.path)
    await workbook.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer)
    const sheet = workbook.worksheets[0]
    assert.equal(sheet.getCell('A1').value, 'Employee number')
    assert.equal(sheet.getCell('I2').value, 'no')
    assert.equal(sheet.actualRowCount, 6)
    const times = [2, 3, 4, 5, 6].map((index) => sheet.getCell(`F${index}`).value)
    assert.deepEqual(times, ['08:00:00', '08:01:00', '08:02:00', '08:03:00', '08:04:00'])
  })
})
