import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AttendanceDay from '#models/attendance_day'
import Subscription from '#models/subscription'
import entitlementService from '#modules/billing/services/entitlement_service'
import dashboardService from '#modules/dashboard/services/dashboard_service'
import { TenantContext } from '#shared/tenant/tenant_context'
import { expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { createLeave } from '#tests/helpers/leaves'
import { createPunch } from '#tests/helpers/timeclock'

type Session = Awaited<ReturnType<typeof hrSession>>
type Client = Parameters<typeof hrSession>[0]

const ZONE = 'Africa/Conakry'

test.group('GET /org/dashboard', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  /** A known organization: 4 present staff, one leaver, a leave, a worked day, a punch. */
  async function setup(client: Client) {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const monthStart = DateTime.now().setZone(ZONE).startOf('month')
    const owner = await hrSession(client, org, ['owner'], { linked: false })
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const newcomer = await createEmployee(org, { hireDate: monthStart })
    await createEmployee(org, { status: 'terminated', endDate: monthStart })
    await createEmployee(org, { status: 'on_leave' })
    await createEmployee(other)

    await createLeave(report.employee!, {
      status: 'approved',
      startDate: monthStart,
      endDate: monthStart,
      requestedDays: '1.00',
      decidedAt: DateTime.now(),
    })
    await createLeave(newcomer)
    await AttendanceDay.create({
      organizationId: org.id,
      employeeId: report.employee!.id,
      day: monthStart,
      workedMinutes: 480,
      punchCount: 2,
      isComplete: true,
    })
    await createPunch(newcomer, {
      punchedAt: monthStart.plus({ hours: 1 }),
      anomaly: 'out_of_zone',
    })
    const get = async (who: Session, query = '') => {
      const response = await expectStatus(
        orgCall(client, 'GET', `/dashboard${query}`, who, org),
        200
      )
      return response.body().data
    }
    return { org, owner, manager, report, monthStart, get }
  }

  test('owner and hr_admin see the whole organization', async ({ client, assert }) => {
    const { owner, monthStart, get } = await setup(client)
    const firstDay = monthStart.toISODate()!
    const data = await get(owner)

    assert.deepEqual(data.period, {
      from: firstDay,
      to: monthStart.endOf('month').toISODate(),
    })
    assert.deepEqual(data.headcount, { total: 4, active: 3, onLeave: 1, newHires: 1, exits: 1 })
    assert.deepEqual(data.leaves, { pending: 1, approvedThisPeriod: 1, daysTaken: 1 })
    // Manager, report and newcomer are absent today, unless today is the first of the
    // month: the report's worked day then makes them present.
    const today = DateTime.now().setZone(ZONE).toISODate()
    assert.deepEqual(data.attendance, {
      punctualityRate: null,
      avgWorkedHours: 8,
      absencesToday: today === firstDay ? 2 : 3,
      outOfZonePunches: 1,
    })
    assert.isNull(data.recruitment)
    assert.isNull(data.performance)
    assert.deepEqual(data.series.punchesByDay, [{ day: firstDay, count: 1 }])
    assert.deepEqual(data.series.leavesByType, [{ type: 'annual', days: 1 }])
    assert.lengthOf(data.series.headcountByMonth, 12)
    assert.deepEqual(data.series.headcountByMonth.at(-1), {
      month: monthStart.toFormat('yyyy-MM'),
      total: 5,
    })
  })

  test('a manager sees the team, an employee only themselves', async ({ client, assert }) => {
    const { manager, report, get } = await setup(client)

    const team = await get(manager)
    assert.deepEqual(team.headcount, { total: 2, active: 2, onLeave: 0, newHires: 0, exits: 0 })
    assert.deepEqual(team.leaves, { pending: 0, approvedThisPeriod: 1, daysTaken: 1 })
    assert.equal(team.attendance.outOfZonePunches, 0)
    assert.equal(team.attendance.avgWorkedHours, 8)

    const self = await get(report)
    assert.equal(self.headcount.total, 1)
    assert.deepEqual(self.leaves, { pending: 0, approvedThisPeriod: 1, daysTaken: 1 })
    assert.deepEqual(self.series.punchesByDay, [])
  })

  test('validates the period, caches 5 minutes, hides unpaid modules', async ({
    client,
    assert,
  }) => {
    const { org, owner, get } = await setup(client)
    await expectStatus(orgCall(client, 'GET', '/dashboard?period=year', owner, org), 422)

    const week = await get(owner, '?period=week')
    assert.equal(DateTime.fromISO(week.period.from).weekday, 1)
    const first = await get(owner)
    await createEmployee(org)
    const cached = await get(owner)
    assert.equal(cached.headcount.total, first.headcount.total)

    // jsonb column: written serialized, as the billing module will.
    await Subscription.query()
      .where('organization_id', org.id)
      .update({ modules_override: JSON.stringify(['hr']) })
    await entitlementService.invalidate(org.id)
    const restricted = await get(owner, '?period=quarter')
    assert.isNotNull(restricted.headcount)
    assert.isNull(restricted.attendance)
    assert.isNull(restricted.leaves)
    assert.isNull(restricted.series.punchesByDay)
    assert.isNull(restricted.series.leavesByType)
  })

  test('a member without employee record gets zeros', async ({ client, assert }) => {
    const { org, get } = await setup(client)
    const recruiter = await hrSession(client, org, ['recruiter'], { linked: false })
    const data = await get(recruiter)
    assert.deepEqual(data.headcount, { total: 0, active: 0, onLeave: 0, newHires: 0, exits: 0 })
    assert.equal(data.attendance.absencesToday, 0)
  })

  test('computes under RLS, other tenants excluded', async ({ client, assert }) => {
    const { org } = await setup(client)
    await entitlementService.resolve(org.id)

    await db.rawQuery('SET LOCAL ROLE konkoure_app')
    const data = await dashboardService.show(new TenantContext(org.id, ['owner']), 'month')
    assert.equal(data.headcount!.total, 4)
    assert.equal(data.attendance!.outOfZonePunches, 1)
  })
})
