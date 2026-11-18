import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import Department from '#models/department'
import Employee from '#models/employee'
import { createOrganization } from '#tests/helpers/auth'
import { errorOf, expectStatus } from '#tests/helpers/http'
import {
  createDepartment,
  createEmployee,
  createHrOrganization,
  hrSession,
  orgCall,
} from '#tests/helpers/hr'

test.group('/org/departments', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('every member lists and reads the departments of their organization', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const employee = await hrSession(client, org, ['employee'])
    const mine = await createDepartment(org, 'Finance')
    const foreign = await createDepartment(other, 'Secret')

    const list = await expectStatus(orgCall(client, 'GET', '/departments', employee, org), 200)
    assert.deepEqual(
      list.body().data.map((row: { id: string }) => row.id),
      [mine.id]
    )
    assert.equal(list.body().meta.total, 1)
    await expectStatus(orgCall(client, 'GET', `/departments/${mine.id}`, employee, org), 200)
    await expectStatus(orgCall(client, 'GET', `/departments/${foreign.id}`, employee, org), 404)
  })

  test('requires the hr module to be available', async ({ client, assert }) => {
    const org = await createOrganization()
    const owner = await hrSession(client, org, ['owner'], { linked: false })
    const response = await expectStatus(orgCall(client, 'GET', '/departments', owner, org), 403)
    assert.equal(errorOf(response).code, 'E_SUBSCRIPTION_INACTIVE')
  })

  test('hr_admin creates and updates, with audit', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const admin = await hrSession(client, org, ['hr_admin'])
    const head = await createEmployee(org)

    const created = await expectStatus(
      orgCall(client, 'POST', '/departments', admin, org).json({
        name: 'Ressources humaines',
        managerId: head.id,
      }),
      201
    )
    const { id } = created.body().data
    assert.equal(created.body().data.managerId, head.id)

    const updated = await expectStatus(
      orgCall(client, 'PATCH', `/departments/${id}`, admin, org).json({
        description: 'RH',
        managerId: null,
      }),
      200
    )
    assert.isNull(updated.body().data.managerId)
    const actions = await AuditLog.query().where('target_id', id).orderBy('created_at')
    assert.sameMembers(
      actions.map((log) => log.action),
      ['department.created', 'department.updated']
    )
  })

  test('other roles cannot write', async ({ client }) => {
    const org = await createHrOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const department = await createDepartment(org)

    await expectStatus(
      orgCall(client, 'POST', '/departments', manager, org).json({ name: 'Non' }),
      403
    )
    await expectStatus(
      orgCall(client, 'PATCH', `/departments/${department.id}`, manager, org).json({ name: 'Non' }),
      403
    )
    await expectStatus(
      orgCall(client, 'DELETE', `/departments/${department.id}`, manager, org),
      403
    )
  })

  test('validates names and references inside the organization', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    await createDepartment(org, 'Finance')
    const foreignDepartment = await createDepartment(other)
    const foreignEmployee = await createEmployee(other)
    const post = (body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/departments', owner, org).json(body)

    await expectStatus(post({ name: 'x' }), 422)
    const duplicate = await expectStatus(post({ name: 'FINANCE' }), 409)
    assert.equal(errorOf(duplicate).details[0].rule, 'taken')
    const manager = await expectStatus(post({ name: 'A1', managerId: foreignEmployee.id }), 422)
    assert.equal(errorOf(manager).details[0].field, 'managerId')
    const parent = await expectStatus(
      post({ name: 'A2', parentDepartmentId: foreignDepartment.id }),
      422
    )
    assert.equal(errorOf(parent).details[0].field, 'parentDepartmentId')
  })

  test('a department of another organization is 404 for writes', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const foreign = await createDepartment(other, 'Secret')

    await expectStatus(
      orgCall(client, 'PATCH', `/departments/${foreign.id}`, owner, org).json({ name: 'Volé' }),
      404
    )
    await expectStatus(orgCall(client, 'DELETE', `/departments/${foreign.id}`, owner, org), 404)
    await foreign.refresh()
    assert.equal(foreign.name, 'Secret')
    assert.isNull(foreign.deletedAt)
  })

  test('refuses a parent cycle', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const parent = await createDepartment(org)
    const child = await Department.create({
      organizationId: org.id,
      name: 'Enfant',
      parentDepartmentId: parent.id,
    })

    const response = await expectStatus(
      orgCall(client, 'PATCH', `/departments/${parent.id}`, owner, org).json({
        parentDepartmentId: child.id,
      }),
      422
    )
    assert.equal(errorOf(response).code, 'E_HIERARCHY_CYCLE')
  })

  test('deletion needs an empty department or a destination', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const source = await createDepartment(org)
    const target = await createDepartment(org)
    const child = await Department.create({
      organizationId: org.id,
      name: 'Enfant',
      parentDepartmentId: source.id,
    })
    const employee = await createEmployee(org, { departmentId: source.id })
    const path = `/departments/${source.id}`

    const blocked = await expectStatus(orgCall(client, 'DELETE', path, owner, org), 409)
    assert.equal(errorOf(blocked).details[0].rule, 'hasEmployees')
    await expectStatus(
      orgCall(client, 'DELETE', `${path}?reassignTo=${source.id}`, owner, org),
      422
    )
    await expectStatus(
      orgCall(client, 'DELETE', `${path}?reassignTo=${target.id}`, owner, org),
      204
    )

    await source.refresh()
    await child.refresh()
    await employee.refresh()
    assert.isNotNull(source.deletedAt)
    assert.isNull(child.parentDepartmentId)
    assert.equal(employee.departmentId, target.id)
    await expectStatus(orgCall(client, 'GET', path, owner, org), 404)
  })

  test('its employee list follows the viewer scope', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const department = await createDepartment(org)
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'])
    const report = await createEmployee(org, {
      departmentId: department.id,
      managerId: manager.employee!.id,
    })
    await createEmployee(org, { departmentId: department.id })
    const path = `/departments/${department.id}/employees`

    const response = await expectStatus(orgCall(client, 'GET', path, manager, org), 200)
    assert.deepEqual(
      response.body().data.map((row: { id: string }) => row.id),
      [report.id]
    )
    await expectStatus(orgCall(client, 'GET', path, employee, org), 403)
    assert.lengthOf(await Employee.query().where('department_id', department.id), 2)
  })
})
