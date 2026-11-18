import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import Department from '#models/department'
import Employee from '#models/employee'
import departmentService from '#modules/hr/services/department_service'
import employeeService from '#modules/hr/services/employee_service'
import { TenantContext } from '#shared/tenant/tenant_context'
import { withTenant } from '#shared/tenant/with_tenant'
import { createUser, grantRoles } from '#tests/helpers/auth'
import { createEmployee, createHrOrganization } from '#tests/helpers/hr'

test.group('HR services under the application role', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('mutations work with RLS enforced, which hides other tenants', async ({ assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await createUser({ emailVerifiedAt: DateTime.now() })
    const leaver = await createUser({ emailVerifiedAt: DateTime.now() })
    await grantRoles(owner, org, ['owner'])
    await grantRoles(leaver, org, ['manager'])
    const linked = await createEmployee(org, { userId: leaver.id })
    const foreign = await createEmployee(other)
    const tenant = new TenantContext(org.id, ['owner'])

    // Lasts until the global transaction rolls back at the end of the test.
    await db.rawQuery('SET LOCAL ROLE konkoure_app')

    const department = await departmentService.create(tenant, owner, { name: 'Finance' }, {})
    const employee = await employeeService.create(
      tenant,
      owner,
      {
        firstName: 'Mariama',
        lastName: 'Sow',
        departmentId: department.id,
        managerId: linked.id,
      },
      {}
    )
    await employeeService.update(tenant, owner, linked.id, { status: 'terminated' }, {})
    await employeeService.remove(tenant, owner, employee.id, {})
    await employeeService.restore(tenant, owner, employee.id, {})
    const { meta } = await employeeService.list(tenant, {})
    assert.equal(meta.total, 2)

    await employeeService.update(tenant, owner, employee.id, { departmentId: null }, {})
    await departmentService.remove(tenant, owner, department.id, undefined, {})

    const visible = await withTenant(org.id, (trx) => {
      return Employee.query({ client: trx }).where('id', foreign.id)
    })
    assert.lengthOf(visible, 0)
    await assert.rejects(() =>
      withTenant(org.id, (trx) =>
        Department.create({ organizationId: other.id, name: 'Intrus' }, { client: trx })
      )
    )
  })
})
