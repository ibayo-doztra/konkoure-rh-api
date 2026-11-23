import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import { expectStatus } from '#tests/helpers/http'
import {
  createDepartment,
  createEmployee,
  createHrOrganization,
  hrSession,
  orgCall,
} from '#tests/helpers/hr'

test.group('GET /org/employees/directory (added 2026-11-23)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('every member reads present staff in reduced fields', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])
    const department = await createDepartment(org)
    const colleague = await createEmployee(org, {
      firstName: 'Mamadou',
      lastName: 'Diallo',
      departmentId: department.id,
      email: 'mamadou@example.com',
      status: 'on_leave',
    })
    await createEmployee(org, { status: 'terminated' })
    await createEmployee(await createHrOrganization('Autre'))

    const response = await expectStatus(
      orgCall(client, 'GET', '/employees/directory', employee, org),
      200
    )
    const rows = response.body().data as Array<Record<string, unknown>>
    assert.sameMembers(
      rows.map((row) => row.id),
      [employee.employee!.id, colleague.id]
    )
    const row = rows.find((item) => item.id === colleague.id)!
    assert.sameMembers(Object.keys(row), [
      'id',
      'firstName',
      'lastName',
      'jobTitle',
      'departmentId',
      'photoUrl',
    ])
    assert.equal(response.body().meta.total, 2)
  })

  test('searches by name only and filters by department', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const employee = await hrSession(client, org, ['employee'])
    const department = await createDepartment(org)
    const target = await createEmployee(org, {
      firstName: 'Mariama',
      lastName: 'Sow',
      email: 'secret@example.com',
      departmentId: department.id,
    })
    const get = async (query: string) => {
      const response = await expectStatus(
        orgCall(client, 'GET', `/employees/directory${query}`, employee, org),
        200
      )
      return response.body().data.map((row: { id: string }) => row.id)
    }

    assert.deepEqual(await get('?q=mariama%20s'), [target.id])
    assert.deepEqual(await get('?q=secret'), [])
    assert.deepEqual(await get(`?filter[departmentId]=${department.id}`), [target.id])
    await expectStatus(
      orgCall(client, 'GET', '/employees/directory?filter[departmentId]=x', employee, org),
      422
    )
  })
})
