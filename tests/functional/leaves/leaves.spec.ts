import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import type Organization from '#models/organization'
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

const ids = (response: { body(): { data: Array<{ id: string }> } }) =>
  response.body().data.map((row) => row.id)

async function setLeaveSettings(organization: Organization, leave: Record<string, unknown>) {
  organization.merge({ settings: { leave } })
  await organization.save()
}

test.group('POST /org/leaves', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('computes the days server-side and reserves them', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'], {
      managerId: manager.employee!.id,
    })
    await createHoliday(org, monday().plus({ days: 2 }))

    const response = await expectStatus(
      orgCall(client, 'POST', '/leaves', employee, org).json({
        type: 'annual',
        ...week(),
        halfDayEnd: true,
        requestedDays: 1,
        reason: 'Mariage',
      }),
      201
    )
    const body = response.body().data
    assert.deepInclude(body, {
      employeeId: employee.employee!.id,
      status: 'pending',
      requestedDays: 3.5,
      approverId: manager.employee!.id,
      balanceAfter: 26.5,
      reason: 'Mariage',
    })

    const balance = await balanceOf(employee.employee!)
    assert.equal(Number(balance.entitledDays), 30)
    assert.equal(Number(balance.pendingDays), 3.5)
    assert.equal(await ledgerSum(employee.employee!), displayed(balance))
  })

  test('refuses an overlap with a pending or approved leave', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])
    await createLeave(employee.employee!, { startDate: monday(), endDate: monday() })
    const response = await expectStatus(
      orgCall(client, 'POST', '/leaves', employee, org).json({ type: 'sick', ...week() }),
      409
    )
    assert.equal(errorOf(response).code, 'E_LEAVE_OVERLAP')

    await createLeave(employee.employee!, {
      startDate: monday(1),
      endDate: monday(1),
      status: 'rejected',
    })
    await expectStatus(
      orgCall(client, 'POST', '/leaves', employee, org).json({ type: 'sick', ...week(1) }),
      201
    )
  })

  test('enforces the negative limit on annual and special leave only', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])
    const request = (type: string, weeks: number, from = 0) =>
      orgCall(client, 'POST', '/leaves', employee, org).json({
        type,
        startDate: iso(monday(from)),
        endDate: iso(monday(from + weeks - 1).plus({ days: 4 })),
      })

    // 30 days granted, 5 negative allowed: 35 days pass, 40 do not.
    const refused = await expectStatus(request('annual', 8), 422)
    assert.equal(errorOf(refused).code, 'E_INSUFFICIENT_BALANCE')
    await expectStatus(request('annual', 7), 201)

    // `special` starts at 0: 5 days pass, 10 do not.
    await expectStatus(request('special', 2, 10), 422)
    await expectStatus(request('special', 1, 10), 201)

    const sick = await expectStatus(request('sick', 10, 20), 201)
    assert.isNull(sick.body().data.balanceAfter)
  })

  test('refuses any negative balance when the organization forbids it', async ({ client }) => {
    const org = await createHrOrganization()
    await setLeaveSettings(org, { annualEntitlementDays: 4, allowNegativeBalance: false })
    const employee = await hrSession(client, org, ['employee'])
    await expectStatus(
      orgCall(client, 'POST', '/leaves', employee, org).json({ type: 'annual', ...week() }),
      422
    )
  })

  test('lets owner and hr_admin request for another employee only', async ({ client }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const employee = await hrSession(client, org, ['employee'])
    const other = await createEmployee(org)
    const body = { employeeId: other.id, type: 'annual', ...week() }

    await expectStatus(orgCall(client, 'POST', '/leaves', employee, org).json(body), 403)
    await expectStatus(orgCall(client, 'POST', '/leaves', hr, org).json(body), 201)
    const unlinked = await hrSession(client, org, ['manager'], { linked: false })
    await expectStatus(
      orgCall(client, 'POST', '/leaves', unlinked, org).json({ type: 'annual', ...week() }),
      403
    )
  })

  test('validates dates, days and the employee', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const post = (body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/leaves', owner, org).json({ type: 'annual', ...body })
    const saturday = iso(monday().minus({ days: 2 }))

    await expectStatus(post({ startDate: week().endDate, endDate: week().startDate }), 422)
    await expectStatus(post({ ...week(), type: 'holiday' }), 422)
    const weekend = await expectStatus(post({ startDate: saturday, endDate: saturday }), 422)
    assert.equal(errorOf(weekend).details[0].rule, 'noWorkingDay')
    const span = await expectStatus(
      post({ startDate: `${YEAR}-12-30`, endDate: `${YEAR + 1}-01-04` }),
      422
    )
    assert.equal(errorOf(span).details[0].rule, 'sameYear')
    const foreign = await createEmployee(other)
    await expectStatus(post({ ...week(), employeeId: foreign.id }), 422)
  })
})

test.group('GET /org/leaves', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('scopes the list by role and hides other tenants', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const own = await createLeave(manager.employee!)
    const team = await createLeave(report.employee!)
    const unrelated = await createLeave(await createEmployee(org))
    const foreign = await createLeave(await createEmployee(other))
    const get = (who: { accessToken: string }, query = '') =>
      expectStatus(orgCall(client, 'GET', `/leaves${query}`, who, org), 200)

    const all = await get(owner)
    assert.sameMembers(ids(all), [own.id, team.id, unrelated.id])
    assert.notInclude(ids(all), foreign.id)
    assert.sameMembers(ids(await get(manager)), [own.id, team.id])
    assert.deepEqual(ids(await get(report)), [team.id])
    assert.deepEqual(ids(await get(owner, `?filter[employeeId]=${report.employee!.id}`)), [team.id])
    assert.deepEqual(ids(await get(owner, '?filter[status]=approved')), [])
  })

  test('shows a leave to its viewers only, 404 across tenants', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const peer = await hrSession(client, org, ['employee'])
    const leave = await createLeave(report.employee!)
    const foreign = await createLeave(await createEmployee(other))

    const shown = await expectStatus(
      orgCall(client, 'GET', `/leaves/${leave.id}`, manager, org),
      200
    )
    assert.equal(shown.body().data.approverId, manager.employee!.id)
    await expectStatus(orgCall(client, 'GET', `/leaves/${leave.id}`, peer, org), 403)
    await expectStatus(orgCall(client, 'GET', `/leaves/${foreign.id}`, manager, org), 404)
  })
})

test.group('Leave decisions', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  async function requested(client: Parameters<typeof hrSession>[0]) {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'], {
      managerId: manager.employee!.id,
    })
    const response = await expectStatus(
      orgCall(client, 'POST', '/leaves', employee, org).json({ type: 'annual', ...week() }),
      201
    )
    return { org, owner, manager, employee, leaveId: response.body().data.id as string }
  }

  test('the team manager approves: pending days become taken', async ({ client, assert }) => {
    const { org, manager, employee, leaveId } = await requested(client)

    const response = await expectStatus(
      orgCall(client, 'POST', `/leaves/${leaveId}/approve`, manager, org),
      200
    )
    assert.deepInclude(response.body().data, {
      status: 'approved',
      decidedBy: manager.user.id,
      balanceAfter: 25,
    })
    const balance = await balanceOf(employee.employee!)
    assert.equal(Number(balance.takenDays), 5)
    assert.equal(Number(balance.pendingDays), 0)
    assert.equal(await ledgerSum(employee.employee!), displayed(balance))
    const audit = await AuditLog.query()
      .where('organization_id', org.id)
      .where('action', 'leave.approved')
    assert.lengthOf(audit, 1)

    const again = await expectStatus(
      orgCall(client, 'POST', `/leaves/${leaveId}/approve`, manager, org),
      409
    )
    assert.equal(errorOf(again).details[0].rule, 'notPending')
  })

  test('nobody decides on their own leave, nor outside their team', async ({ client }) => {
    const { org, owner, manager, employee, leaveId } = await requested(client)
    const peer = await hrSession(client, org, ['manager'])

    await expectStatus(orgCall(client, 'POST', `/leaves/${leaveId}/approve`, employee, org), 403)
    await expectStatus(orgCall(client, 'POST', `/leaves/${leaveId}/approve`, peer, org), 403)

    const own = await expectStatus(
      orgCall(client, 'POST', '/leaves', manager, org).json({ type: 'annual', ...week(3) }),
      201
    )
    const ownId = own.body().data.id
    await expectStatus(orgCall(client, 'POST', `/leaves/${ownId}/approve`, manager, org), 403)
    const ownerLeave = await expectStatus(
      orgCall(client, 'POST', '/leaves', owner, org).json({ type: 'annual', ...week(4) }),
      201
    )
    await expectStatus(
      orgCall(client, 'POST', `/leaves/${ownerLeave.body().data.id}/approve`, owner, org),
      403
    )
    await expectStatus(orgCall(client, 'POST', `/leaves/${ownId}/approve`, owner, org), 200)
  })

  test('rejection requires a comment and releases the days', async ({ client, assert }) => {
    const { org, manager, employee, leaveId } = await requested(client)
    const reject = (decisionComment?: string) =>
      orgCall(client, 'POST', `/leaves/${leaveId}/reject`, manager, org).json({ decisionComment })

    await expectStatus(reject(), 422)
    await expectStatus(reject('Non'), 422)
    const response = await expectStatus(reject('Période de clôture'), 200)
    assert.deepInclude(response.body().data, {
      status: 'rejected',
      decisionComment: 'Période de clôture',
    })
    const balance = await balanceOf(employee.employee!)
    assert.equal(displayed(balance), 30)
    assert.equal(await ledgerSum(employee.employee!), 30)
  })

  test('cancellation follows the state and the role', async ({ client, assert }) => {
    const { org, owner, manager, employee, leaveId } = await requested(client)
    await expectStatus(orgCall(client, 'POST', `/leaves/${leaveId}/approve`, manager, org), 200)

    // Approved: owner and hr_admin only, and only before the first day.
    await expectStatus(orgCall(client, 'POST', `/leaves/${leaveId}/cancel`, employee, org), 403)
    await expectStatus(orgCall(client, 'POST', `/leaves/${leaveId}/cancel`, manager, org), 403)
    const cancelled = await expectStatus(
      orgCall(client, 'POST', `/leaves/${leaveId}/cancel`, owner, org),
      200
    )
    assert.equal(cancelled.body().data.status, 'cancelled')
    const balance = await balanceOf(employee.employee!)
    assert.equal(displayed(balance), 30)
    assert.equal(await ledgerSum(employee.employee!), 30)

    const started = await createLeave(employee.employee!, {
      status: 'approved',
      startDate: DateTime.now().minus({ days: 1 }),
      endDate: DateTime.now().plus({ days: 1 }),
      requestedDays: '3.00',
    })
    const locked = await expectStatus(
      orgCall(client, 'POST', `/leaves/${started.id}/cancel`, owner, org),
      409
    )
    assert.equal(errorOf(locked).details[0].rule, 'locked')
  })

  test('the author cancels a pending request', async ({ client, assert }) => {
    const { org, employee, leaveId } = await requested(client)
    const response = await expectStatus(
      orgCall(client, 'POST', `/leaves/${leaveId}/cancel`, employee, org),
      200
    )
    assert.equal(response.body().data.status, 'cancelled')
    assert.equal(displayed(await balanceOf(employee.employee!)), 30)
  })

  test('the author changes a pending request; days are recomputed', async ({ client, assert }) => {
    const { org, manager, employee, leaveId } = await requested(client)
    const patch = (who: typeof employee, body: Record<string, unknown>) =>
      orgCall(client, 'PATCH', `/leaves/${leaveId}`, who, org).json(body)

    await expectStatus(patch(manager, { halfDayStart: true }), 403)
    const response = await expectStatus(
      patch(employee, { endDate: iso(monday().plus({ days: 1 })) }),
      200
    )
    assert.deepInclude(response.body().data, { requestedDays: 2, balanceAfter: 28 })
    const balance = await balanceOf(employee.employee!)
    assert.equal(Number(balance.pendingDays), 2)
    assert.equal(await ledgerSum(employee.employee!), displayed(balance))

    await expectStatus(orgCall(client, 'POST', `/leaves/${leaveId}/approve`, manager, org), 200)
    await expectStatus(patch(employee, { halfDayStart: true }), 409)
  })
})
