import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import Employee from '#models/employee'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { YEAR, balanceOf, createHoliday, displayed, ledgerSum, week } from '#tests/helpers/leaves'

const currentYear = () => DateTime.now().setZone('Africa/Conakry').year

test.group('GET /org/leaves/balances', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('scopes balances by role', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const peer = await hrSession(client, org, ['employee'])
    for (const who of [manager, report, peer]) {
      await expectStatus(
        orgCall(client, 'POST', '/leaves', who, org).json({ type: 'annual', ...week() }),
        201
      )
    }
    const get = (who: typeof owner, query = '') =>
      expectStatus(orgCall(client, 'GET', `/leaves/balances?year=${YEAR}${query}`, who, org), 200)
    const employees = (response: Awaited<ReturnType<typeof get>>) =>
      (response.body().data as Array<{ employeeId: string }>).map((row) => row.employeeId)

    assert.sameMembers(employees(await get(owner)), [
      manager.employee!.id,
      report.employee!.id,
      peer.employee!.id,
    ])
    assert.sameMembers(employees(await get(manager)), [manager.employee!.id, report.employee!.id])
    const mine = await get(report)
    assert.deepEqual(mine.body().data, [
      {
        employeeId: report.employee!.id,
        year: YEAR,
        leaveType: 'annual',
        entitledDays: 30,
        carriedOverDays: 0,
        takenDays: 0,
        pendingDays: 5,
        balance: 25,
      },
    ])
    await expectStatus(
      orgCall(client, 'GET', `/leaves/balances?employeeId=${peer.employee!.id}`, manager, org),
      403
    )
  })
})

test.group('POST /org/leaves/balances/adjust', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('hr adjusts an entitlement: ledger, audit and employee cache', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const employee = await createEmployee(org)

    const response = await expectStatus(
      orgCall(client, 'POST', '/leaves/balances/adjust', hr, org).json({
        employeeId: employee.id,
        leaveType: 'annual',
        deltaDays: -2.5,
        reason: 'Correction de reprise',
      }),
      200
    )
    assert.deepInclude(response.body().data, { year: currentYear(), entitledDays: 27.5 })

    const balance = await balanceOf(employee, 'annual', currentYear())
    assert.equal(await ledgerSum(employee, 'annual', currentYear()), displayed(balance))
    const cached = await Employee.findOrFail(employee.id)
    assert.equal(Number(cached.leaveBalance), 27.5)
    const [audit] = await AuditLog.query()
      .where('organization_id', org.id)
      .where('action', 'leave_balance.adjusted')
    assert.equal(audit.targetId, employee.id)
  })

  test('refuses managers, zero changes and other tenants', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const employee = await createEmployee(org)
    const adjust = (who: typeof owner, body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/leaves/balances/adjust', who, org).json({
        employeeId: employee.id,
        leaveType: 'special',
        deltaDays: 3,
        reason: 'Événement familial',
        ...body,
      })

    await expectStatus(adjust(manager, {}), 403)
    const zero = await expectStatus(adjust(owner, { deltaDays: 0 }), 422)
    assert.equal(errorOf(zero).details[0].rule, 'notZero')
    await expectStatus(adjust(owner, { reason: 'x' }), 422)
    const foreign = await createEmployee(other)
    await expectStatus(adjust(owner, { employeeId: foreign.id }), 422)
  })
})

test.group('/org/holidays', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('imports the fixed Guinean holidays once', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    await createHoliday(org, DateTime.fromISO(`${YEAR}-01-01`), 'Nouvel An maison')
    const run = () =>
      expectStatus(
        orgCall(client, 'POST', '/holidays/import', owner, org).json({ year: YEAR }),
        200
      )

    const first = await run()
    assert.lengthOf(first.body().data, 8)
    assert.equal(first.body().data[0].name, 'Nouvel An maison')
    const second = await run()
    assert.lengthOf(second.body().data, 8)
  })

  test('everyone reads, owner and hr_admin write', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const other = await createHrOrganization('Autre')
    const hr = await hrSession(client, org, ['hr_admin'])
    const employee = await hrSession(client, org, ['employee'])
    const body = { name: 'Tabaski', date: `${YEAR}-05-27`, isMovable: true }

    await expectStatus(orgCall(client, 'POST', '/holidays', employee, org).json(body), 403)
    const created = await expectStatus(
      orgCall(client, 'POST', '/holidays', hr, org).json(body),
      201
    )
    const id = created.body().data.id
    const duplicate = await expectStatus(
      orgCall(client, 'POST', '/holidays', hr, org).json(body),
      409
    )
    assert.equal(errorOf(duplicate).details[0].field, 'date')

    const listed = await expectStatus(
      orgCall(client, 'GET', `/holidays?year=${YEAR}`, employee, org),
      200
    )
    assert.deepEqual(listed.body().data, [
      { id, name: 'Tabaski', date: `${YEAR}-05-27`, isMovable: true, isRecurring: false },
    ])
    await expectStatus(
      orgCall(client, 'PATCH', `/holidays/${id}`, hr, org).json({ date: `${YEAR}-05-28` }),
      200
    )
    const foreign = await createHoliday(other, DateTime.fromISO(`${YEAR}-06-01`))
    await expectStatus(
      orgCall(client, 'PATCH', `/holidays/${foreign.id}`, hr, org).json({ name: 'Volé' }),
      404
    )
    await expectStatus(orgCall(client, 'DELETE', `/holidays/${foreign.id}`, hr, org), 404)
    await expectStatus(orgCall(client, 'DELETE', `/holidays/${id}`, employee, org), 403)
    await expectStatus(orgCall(client, 'DELETE', `/holidays/${id}`, hr, org), 204)
  })
})
