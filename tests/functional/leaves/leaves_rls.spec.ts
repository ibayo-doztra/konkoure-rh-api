import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import LeaveRequest from '#models/leave_request'
import holidayService from '#modules/leaves/services/holiday_service'
import leaveBalanceService from '#modules/leaves/services/leave_balance_service'
import leaveService from '#modules/leaves/services/leave_service'
import { TenantContext } from '#shared/tenant/tenant_context'
import { withTenant } from '#shared/tenant/with_tenant'
import { createUser, grantRoles } from '#tests/helpers/auth'
import { createEmployee, createHrOrganization } from '#tests/helpers/hr'
import { YEAR, createLeave, monday } from '#tests/helpers/leaves'

test.group('Leave services under the application role', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the whole cycle works with RLS enforced, which hides other tenants', async ({ assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await createUser({ emailVerifiedAt: DateTime.now() })
    await grantRoles(owner, org, ['owner'])
    const employee = await createEmployee(org)
    const foreign = await createLeave(await createEmployee(other))
    const tenant = new TenantContext(org.id, ['owner'])

    // Lasts until the global transaction rolls back at the end of the test.
    await db.rawQuery('SET LOCAL ROLE konkoure_app')

    await holidayService.importYear(tenant, YEAR)
    const input = {
      type: 'annual' as const,
      startDate: monday(),
      endDate: monday(0).plus({ days: 4 }),
    }
    const { leave } = await leaveService.create(tenant, owner, employee.id, input, {})
    await leaveService.approve(tenant, owner, leave.id, {})
    await leaveService.cancel(tenant, owner, leave.id, {})
    await leaveBalanceService.adjust(
      tenant,
      owner,
      { employeeId: employee.id, leaveType: 'annual', deltaDays: 1, reason: 'Ancienneté' },
      {}
    )
    const { rows } = await leaveService.list(tenant, {})
    assert.deepEqual(
      rows.map((row) => row.id),
      [leave.id]
    )
    await assert.rejects(() => leaveService.find(tenant, foreign.id))
  })

  test('the ledger is insert only for the application role', async ({ assert }) => {
    const org = await createHrOrganization()
    const owner = await createUser({ emailVerifiedAt: DateTime.now() })
    await grantRoles(owner, org, ['owner'])
    const employee = await createEmployee(org)
    const tenant = new TenantContext(org.id, ['owner'])
    await leaveBalanceService.adjust(
      tenant,
      owner,
      { employeeId: employee.id, leaveType: 'annual', deltaDays: 1, reason: 'Ancienneté' },
      {}
    )

    await db.rawQuery('SET LOCAL ROLE konkoure_app')
    await assert.rejects(() =>
      withTenant(org.id, (trx) =>
        trx.from('leave_balance_ledger').where('organization_id', org.id).update({ delta_days: 99 })
      )
    )
  })

  test('the database refuses overlapping leaves', async ({ assert }) => {
    const org = await createHrOrganization()
    const employee = await createEmployee(org)
    const first = await createLeave(employee)
    // Own savepoint: the violation must not abort the global test transaction.
    await assert.rejects(() =>
      db.transaction((trx) =>
        LeaveRequest.create(
          {
            organizationId: org.id,
            employeeId: employee.id,
            type: 'sick',
            status: 'approved',
            startDate: first.endDate,
            endDate: first.endDate.plus({ days: 2 }),
            requestedDays: '1.00',
          },
          { client: trx }
        )
      )
    )
    const kept = await LeaveRequest.query().where('employee_id', employee.id)
    assert.lengthOf(kept, 1)
  })
})
