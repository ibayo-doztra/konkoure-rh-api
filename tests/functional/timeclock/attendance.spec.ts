import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import redis from '@adonisjs/redis/services/main'
import AttendanceDay from '#models/attendance_day'
import AuditLog from '#models/audit_log'
import type Employee from '#models/employee'
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
    await expectStatus(call('?filter[anomaly]=late'), 422)
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

test.group('GET /org/timeclock/logs/export', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  const period = (from: string, to: string) =>
    `filter[from]=${encodeURIComponent(on('00:00', from).toISO()!)}` +
    `&filter[to]=${encodeURIComponent(on('23:59', to).toISO()!)}`

  test('exports the punches of the organization as CSV, audited', async ({ client, assert }) => {
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

    const response = await expectStatus(
      orgCall(client, 'GET', `/timeclock/logs/export?format=csv&${period(DAY, DAY)}`, hr, org),
      200
    )
    assert.match(response.header('content-type') ?? '', /text\/csv/)
    assert.include(response.header('content-disposition') ?? '', `pointages_${DAY}_${DAY}.csv`)
    // trim() also drops the BOM.
    const lines = response.text().trim().split('\r\n')
    assert.lengthOf(lines, 3)
    assert.equal(
      lines[0],
      'Matricule;Nom;Prénom;Type;Date;Heure;Source;Zone;Dans la zone;Anomalie;Notes'
    )
    assert.equal(lines[1], `K-001;Diallo;Mariama;in;${DAY};08:02:00;nfc;;non;out_of_zone;`)
    assert.equal(lines[2], `K-001;Diallo;Mariama;out;${DAY};17:00:00;nfc;;non;;'=SUM(A1)`)

    const audit = await AuditLog.query()
      .where('organization_id', org.id)
      .where('action', 'time_log.exported')
      .firstOrFail()
    assert.equal((audit.afterData as { rows: number }).rows, 2)
  })

  test('XLSX, English headers and refusals', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const agent = await hrSession(client, org, ['security_agent'])
    const call = (who: Session, query: string) =>
      orgCall(client, 'GET', `/timeclock/logs/export?${query}`, who, org)

    const xlsx = await expectStatus(
      call(owner, `format=xlsx&${period(DAY, DAY)}`).header('Accept-Language', 'en'),
      200
    )
    assert.include(xlsx.header('content-type') ?? '', 'spreadsheetml')
    await expectStatus(call(manager, `format=csv&${period(DAY, DAY)}`), 403)
    await expectStatus(call(agent, `format=csv&${period(DAY, DAY)}`), 403)
    await expectStatus(call(owner, `format=pdf&${period(DAY, DAY)}`), 422)
    await expectStatus(call(owner, 'format=csv'), 422)
    const tooLong = await expectStatus(call(owner, `format=csv&${period('2026-09-01', DAY)}`), 422)
    assert.equal(errorOf(tooLong).details[0].rule, 'range')
  })

  test('at most 10 exports per hour and user', async ({ client }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const query = `/timeclock/logs/export?format=csv&${period(DAY, DAY)}`
    for (let index = 0; index < 10; index += 1) {
      await expectStatus(orgCall(client, 'GET', query, hr, org), 200)
    }
    await expectStatus(orgCall(client, 'GET', query, hr, org), 429)
  })
})
