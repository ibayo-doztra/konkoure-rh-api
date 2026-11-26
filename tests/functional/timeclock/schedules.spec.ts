import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AttendanceDay from '#models/attendance_day'
import AuditLog from '#models/audit_log'
import type Employee from '#models/employee'
import type Organization from '#models/organization'
import WorkSchedule from '#models/work_schedule'
import attendanceService from '#modules/timeclock/services/attendance_service'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { createHoliday } from '#tests/helpers/leaves'
import { createPunch } from '#tests/helpers/timeclock'

const ZONE = 'Africa/Conakry'
const on = (day: string, time: string) => DateTime.fromISO(`${day}T${time}`, { zone: ZONE })
const OFFICE = { tue: [{ start: '08:00', end: '17:00' }] }

function schedule(organization: Organization, overrides: Partial<WorkSchedule> = {}) {
  return WorkSchedule.create({
    organizationId: organization.id,
    name: `Horaire ${Math.random()}`,
    isDefault: false,
    weeklyPattern: OFFICE,
    employeeId: null,
    ...overrides,
  })
}

function dayOf(employee: Employee, day: string) {
  return AttendanceDay.query().where('employee_id', employee.id).where('day', day).first()
}

test.group('/org/timeclock/schedules', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('HR creates, lists, changes and deletes schedules', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const worker = await createEmployee(org)

    const created = await expectStatus(
      orgCall(client, 'POST', '/timeclock/schedules', hr, org).json({
        name: 'Bureau',
        isDefault: true,
        weeklyPattern: {
          mon: [
            { start: '08:00', end: '12:00' },
            { start: '13:00', end: '17:00' },
          ],
        },
      }),
      201
    )
    const office = created.body().data
    assert.isTrue(office.isDefault)
    assert.deepEqual(office.weeklyPattern.tue, [])
    assert.lengthOf(office.weeklyPattern.mon, 2)

    const own = await expectStatus(
      orgCall(client, 'POST', '/timeclock/schedules', hr, org).json({
        name: 'Nuit de Mariama',
        weeklyPattern: { tue: [{ start: '22:00', end: '06:00' }] },
        employeeId: worker.id,
      }),
      201
    )
    assert.equal(own.body().data.employeeId, worker.id)

    // A new default replaces the former one.
    const other = await expectStatus(
      orgCall(client, 'POST', '/timeclock/schedules', hr, org).json({
        name: 'Équipe du matin',
        isDefault: true,
        weeklyPattern: OFFICE,
      }),
      201
    )
    const list = await expectStatus(orgCall(client, 'GET', '/timeclock/schedules', hr, org), 200)
    assert.deepEqual(
      list
        .body()
        .data.map((row: { name: string; isDefault: boolean }) => [row.name, row.isDefault]),
      [
        ['Équipe du matin', true],
        ['Bureau', false],
        ['Nuit de Mariama', false],
      ]
    )

    const renamed = await expectStatus(
      orgCall(client, 'PATCH', `/timeclock/schedules/${office.id}`, hr, org).json({
        name: 'Bureau central',
      }),
      200
    )
    assert.equal(renamed.body().data.name, 'Bureau central')

    const refused = await expectStatus(
      orgCall(client, 'DELETE', `/timeclock/schedules/${other.body().data.id}`, hr, org),
      409
    )
    assert.equal(errorOf(refused).details[0].rule, 'scheduleDefault')
    await expectStatus(orgCall(client, 'DELETE', `/timeclock/schedules/${office.id}`, hr, org), 204)
    const actions = await AuditLog.query()
      .where('organization_id', org.id)
      .whereLike('action', 'work_schedule.%')
      .orderBy('created_at', 'asc')
    assert.includeMembers(
      actions.map((row) => row.action),
      ['work_schedule.created', 'work_schedule.updated', 'work_schedule.deleted']
    )
  })

  test('validates the pattern, the employee and uniqueness', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const otherOrg = await createHrOrganization('Autre')
    const hr = await hrSession(client, org, ['hr_admin'])
    const worker = await createEmployee(org)
    const stranger = await createEmployee(otherOrg)
    await schedule(org, { name: 'Bureau' })
    await schedule(org, { name: 'Propre', employeeId: worker.id })
    const create = (body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/timeclock/schedules', hr, org).json({
        name: 'Nouveau',
        weeklyPattern: OFFICE,
        ...body,
      })

    const badTime = await expectStatus(
      create({ weeklyPattern: { mon: [{ start: '8h', end: '17:00' }] } }),
      422
    )
    assert.equal(errorOf(badTime).details[0].field, 'weeklyPattern.mon.0.start')
    const overlap = await expectStatus(
      create({
        weeklyPattern: {
          mon: [
            { start: '08:00', end: '12:00' },
            { start: '11:30', end: '17:00' },
          ],
        },
      }),
      422
    )
    assert.equal(errorOf(overlap).details[0].rule, 'scheduleOverlap')
    const foreign = await expectStatus(create({ employeeId: stranger.id }), 422)
    assert.equal(errorOf(foreign).details[0].field, 'employeeId')
    const taken = await expectStatus(create({ employeeId: worker.id }), 409)
    assert.equal(errorOf(taken).details[0].rule, 'scheduleEmployee')
    const newcomer = await createEmployee(org)
    const ownDefault = await expectStatus(
      create({ name: 'Autre', employeeId: newcomer.id, isDefault: true }),
      422
    )
    assert.equal(errorOf(ownDefault).details[0].rule, 'scheduleDefaultEmployee')
    const name = await expectStatus(create({ name: 'bureau' }), 409)
    assert.equal(errorOf(name).details[0].rule, 'scheduleName')
  })

  test('roles: managers read, only owner and HR write', async ({ client }) => {
    const org = await createHrOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'])
    const existing = await schedule(org)

    await expectStatus(orgCall(client, 'GET', '/timeclock/schedules', manager, org), 200)
    await expectStatus(orgCall(client, 'GET', '/timeclock/schedules', employee, org), 403)
    await expectStatus(
      orgCall(client, 'POST', '/timeclock/schedules', manager, org).json({
        name: 'Interdit',
        weeklyPattern: OFFICE,
      }),
      403
    )
    await expectStatus(
      orgCall(client, 'DELETE', `/timeclock/schedules/${existing.id}`, manager, org),
      403
    )
  })

  test('a schedule of another organization is a 404', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const otherOrg = await createHrOrganization('Autre')
    const hr = await hrSession(client, org, ['hr_admin'])
    const foreign = await schedule(otherOrg, { name: 'Étranger' })

    const list = await expectStatus(orgCall(client, 'GET', '/timeclock/schedules', hr, org), 200)
    assert.lengthOf(list.body().data, 0)
    await expectStatus(
      orgCall(client, 'PATCH', `/timeclock/schedules/${foreign.id}`, hr, org).json({
        name: 'Ailleurs',
      }),
      404
    )
    await expectStatus(
      orgCall(client, 'DELETE', `/timeclock/schedules/${foreign.id}`, hr, org),
      404
    )
  })
})

test.group('attendance with work schedules', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('a first in beyond the tolerance is late; holidays and days off are not', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    await schedule(org, { isDefault: true })
    const onTime = await createEmployee(org)
    const late = await createEmployee(org)
    const dayOff = await createEmployee(org)
    // Tuesday 2026-11-10: 08:00 – 17:00, tolerance 10 minutes by default.
    for (const [employee, time, day] of [
      [onTime, '08:09', '2026-11-10'],
      [late, '08:25', '2026-11-10'],
      [dayOff, '09:30', '2026-11-11'],
    ] as const) {
      await createPunch(employee, { type: 'in', punchedAt: on(day, time) })
      await createPunch(employee, { type: 'out', punchedAt: on(day, '17:00') })
      await attendanceService.recompute(org.id, employee.id, day)
    }

    const first = await dayOf(onTime, '2026-11-10')
    assert.equal(first!.lateMinutes, 9)
    assert.isNull(first!.anomaly)
    const second = await dayOf(late, '2026-11-10')
    assert.equal(second!.lateMinutes, 25)
    assert.equal(second!.anomaly, 'late')
    const third = await dayOf(dayOff, '2026-11-11')
    assert.isNull(third!.lateMinutes)

    // Tuesday 2026-11-17 is a public holiday: nobody is late on it.
    await createHoliday(org, DateTime.fromISO('2026-11-17'), 'Férié')
    await createPunch(late, { type: 'in', punchedAt: on('2026-11-17', '11:00') })
    await attendanceService.recompute(org.id, late.id, '2026-11-17')
    const holiday = await dayOf(late, '2026-11-17')
    assert.isNull(holiday!.lateMinutes)

    const hr = await hrSession(client, org, ['hr_admin'])
    const filtered = await expectStatus(
      orgCall(
        client,
        'GET',
        '/timeclock/attendance?filter[from]=2026-11-10&filter[to]=2026-11-11&filter[anomaly]=late',
        hr,
        org
      ),
      200
    )
    assert.deepEqual(
      filtered
        .body()
        .data.map((row: { employeeId: string; lateMinutes: number }) => [
          row.employeeId,
          row.lateMinutes,
        ]),
      [[late.id, 25]]
    )
  })

  test('an own night schedule keeps the morning exit on the shift day', async ({ assert }) => {
    const org = await createHrOrganization()
    await schedule(org, { isDefault: true })
    const guard = await createEmployee(org)
    await schedule(org, {
      name: 'Nuit',
      employeeId: guard.id,
      weeklyPattern: { tue: [{ start: '22:00', end: '06:00' }] },
    })
    await createPunch(guard, { type: 'in', punchedAt: on('2026-11-10', '21:55') })
    await createPunch(guard, { type: 'out', punchedAt: on('2026-11-11', '06:10') })
    await attendanceService.punchChanged({
      organizationId: org.id,
      employeeId: guard.id,
      timezone: ZONE,
      instants: [on('2026-11-11', '06:10')],
    })

    const night = await dayOf(guard, '2026-11-10')
    assert.isTrue(night!.isComplete)
    assert.equal(night!.workedMinutes, 8 * 60 + 15)
    assert.equal(night!.lateMinutes, 0)
    assert.isNull(await dayOf(guard, '2026-11-11'))
  })

  test('closing at 23:59 leaves a night shift open until its window ends', async ({ assert }) => {
    const org = await createHrOrganization()
    const guard = await createEmployee(org)
    await schedule(org, {
      name: 'Nuit',
      employeeId: guard.id,
      weeklyPattern: { tue: [{ start: '22:00', end: '06:00' }] },
    })
    await createPunch(guard, { type: 'in', punchedAt: on('2026-11-10', '22:00') })
    await attendanceService.recompute(org.id, guard.id, '2026-11-10', {
      closed: true,
      at: on('2026-11-10', '23:59'),
    })
    const open = await dayOf(guard, '2026-11-10')
    assert.isNull(open!.anomaly)
    await attendanceService.recompute(org.id, guard.id, '2026-11-10', {
      closed: true,
      at: on('2026-11-11', '23:59'),
    })
    const closed = await dayOf(guard, '2026-11-10')
    assert.equal(closed!.anomaly, 'missing_out')
  })

  test('the dashboard computes the punctuality rate', async ({ client, assert }) => {
    const org = await createHrOrganization()
    await schedule(org, {
      isDefault: true,
      weeklyPattern: Object.fromEntries(
        ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [
          day,
          [{ start: '00:00', end: '23:59' }],
        ])
      ),
    })
    const hr = await hrSession(client, org, ['hr_admin'])
    const today = DateTime.now().setZone(ZONE).toISODate()!
    for (const time of ['00:05', '00:40']) {
      const worker = await createEmployee(org)
      await createPunch(worker, { type: 'in', punchedAt: on(today, time) })
      await attendanceService.recompute(org.id, worker.id, today)
    }
    const response = await expectStatus(
      orgCall(client, 'GET', '/dashboard?period=week', hr, org),
      200
    )
    assert.equal(response.body().data.attendance.punctualityRate, 0.5)
  })
})
