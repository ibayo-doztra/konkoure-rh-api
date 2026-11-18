import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import Employee from '#models/employee'
import UserRole from '#models/user_role'
import { apiLogin, createUser } from '#tests/helpers/auth'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createInvitation } from '#tests/helpers/invitations'
import {
  createDepartment,
  createEmployee,
  createHrOrganization,
  hrSession,
  orgCall,
} from '#tests/helpers/hr'

const ids = (response: { body(): { data: Array<{ id: string }> } }) =>
  response.body().data.map((row) => row.id)

test.group('GET /org/employees', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('scopes the list by role, never crossing organizations', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const direct = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const indirect = await createEmployee(org, { managerId: direct.employee!.id })
    const unrelated = await createEmployee(org)
    const foreign = await createEmployee(other)
    const get = (who: { accessToken: string }) =>
      expectStatus(orgCall(client, 'GET', '/employees?perPage=100', who, org), 200)

    assert.sameMembers(ids(await get(owner)), [
      owner.employee!.id,
      manager.employee!.id,
      direct.employee!.id,
      indirect.id,
      unrelated.id,
    ])
    assert.notInclude(ids(await get(owner)), foreign.id)
    assert.sameMembers(ids(await get(manager)), [
      manager.employee!.id,
      direct.employee!.id,
      indirect.id,
    ])
    assert.deepEqual(ids(await get(direct)), [direct.employee!.id])
  })

  test('recruiters get reduced fields and cannot search private ones', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const recruiter = await hrSession(client, org, ['recruiter'])
    const target = await createEmployee(org, {
      email: 'cachee@doztra.test',
      phone: '622 00 00 00',
      baseSalary: '1500000',
      jobTitle: 'Comptable',
    })

    const list = await expectStatus(orgCall(client, 'GET', '/employees', recruiter, org), 200)
    const row = list.body().data.find((item: { id: string }) => item.id === target.id)
    assert.sameMembers(Object.keys(row), [
      'id',
      'firstName',
      'lastName',
      'jobTitle',
      'departmentId',
      'photoUrl',
    ])
    const search = await expectStatus(
      orgCall(client, 'GET', '/employees?q=cachee', recruiter, org),
      200
    )
    assert.lengthOf(search.body().data, 0)
  })

  test('filters, searches and validates its parameters', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const department = await createDepartment(org)
    const target = await createEmployee(org, {
      firstName: 'Mamadou',
      lastName: 'Sylla',
      departmentId: department.id,
      status: 'suspended',
    })
    const get = (query: string) => orgCall(client, 'GET', `/employees?${query}`, owner, org)

    assert.deepEqual(ids(await expectStatus(get('q=madou%20syl'), 200)), [target.id])
    assert.deepEqual(ids(await expectStatus(get('filter[status]=suspended'), 200)), [target.id])
    assert.deepEqual(ids(await expectStatus(get(`filter[departmentId]=${department.id}`), 200)), [
      target.id,
    ])
    assert.deepEqual(ids(await expectStatus(get('q=%25'), 200)), [])
    await expectStatus(get('sort=salary'), 422)
    await expectStatus(get('perPage=500'), 422)
  })
})

test.group('GET /org/employees/:id', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('applies the visibility of each role', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const self = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const peer = await hrSession(client, org, ['employee'])
    const agent = await hrSession(client, org, ['security_agent'])
    const path = `/employees/${self.employee!.id}`
    const get = async (who: { accessToken: string }) => {
      const response = await expectStatus(orgCall(client, 'GET', path, who, org), 200)
      return response.body().data as Record<string, unknown>
    }

    const full = await get(owner)
    assert.property(full, 'birthDate')
    assert.notProperty(full, 'baseSalary')
    assert.property(await get(self), 'address')
    const team = await get(manager)
    assert.property(team, 'email')
    assert.notProperty(team, 'birthDate')
    assert.notProperty(await get(agent), 'email')
    await expectStatus(orgCall(client, 'GET', path, peer, org), 403)
  })

  test('a manager outside the hierarchy is refused; another tenant is 404', async ({ client }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const manager = await hrSession(client, org, ['manager'])
    const owner = await hrSession(client, org, ['owner'])
    const unrelated = await createEmployee(org)
    const foreign = await createEmployee(other)

    await expectStatus(orgCall(client, 'GET', `/employees/${unrelated.id}`, manager, org), 403)
    await expectStatus(orgCall(client, 'GET', `/employees/${foreign.id}`, owner, org), 404)
    await expectStatus(orgCall(client, 'GET', '/employees/not-a-uuid', owner, org), 422)
  })

  test('the salary is limited to HR and the employee, and audited', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const self = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    await self.employee!.merge({ baseSalary: '2500000.00', salaryCurrency: 'GNF' }).save()
    const path = `/employees/${self.employee!.id}/salary`

    const response = await expectStatus(orgCall(client, 'GET', path, self, org), 200)
    assert.deepEqual(response.body().data, { baseSalary: 2_500_000, salaryCurrency: 'GNF' })
    await expectStatus(orgCall(client, 'GET', path, owner, org), 200)
    await expectStatus(orgCall(client, 'GET', path, manager, org), 403)
    const logs = await AuditLog.query()
      .where('action', 'salary.viewed')
      .where('target_id', self.employee!.id)
    assert.lengthOf(logs, 2)
  })

  test('team and eligible managers', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'], {
      managerId: manager.employee!.id,
    })
    const indirect = await createEmployee(org, { managerId: employee.employee!.id })
    const head = await createEmployee(org)
    await createDepartment(org).then((department) =>
      department.merge({ managerId: head.id }).save()
    )
    const leaver = await createEmployee(org, { status: 'terminated' })
    await createEmployee(org, { managerId: leaver.id })

    const team = await expectStatus(
      orgCall(client, 'GET', `/employees/${manager.employee!.id}/team`, manager, org),
      200
    )
    assert.sameMembers(ids(team), [employee.employee!.id, indirect.id])
    await expectStatus(
      orgCall(client, 'GET', `/employees/${manager.employee!.id}/team`, employee, org),
      403
    )

    const eligible = await expectStatus(
      orgCall(client, 'GET', '/employees/managers', owner, org),
      200
    )
    assert.sameMembers(ids(eligible), [manager.employee!.id, employee.employee!.id, head.id])
    assert.notProperty(eligible.body().data[0], 'email')
    await expectStatus(orgCall(client, 'GET', '/employees/managers', employee, org), 403)
  })
})

test.group('POST and PATCH /org/employees', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('hr_admin creates an employee without exposing the salary', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const admin = await hrSession(client, org, ['hr_admin'])
    const department = await createDepartment(org)

    const response = await expectStatus(
      orgCall(client, 'POST', '/employees', admin, org).json({
        firstName: 'Fatoumata',
        lastName: 'Diallo',
        email: 'FATOU@doztra.test',
        employeeNumber: 'K-001',
        departmentId: department.id,
        hireDate: '2026-02-01',
        baseSalary: 3000000,
        salaryCurrency: 'gnf',
        address: { city: 'Conakry', country: 'GN' },
      }),
      201
    )
    const data = response.body().data
    assert.equal(data.email, 'fatou@doztra.test')
    assert.equal(data.hireDate, '2026-02-01')
    assert.equal(data.address.city, 'Conakry')
    assert.notProperty(data, 'baseSalary')

    const row = await Employee.findOrFail(data.id)
    assert.equal(Number(row.baseSalary), 3_000_000)
    assert.equal(row.salaryCurrency, 'GNF')
    const log = await AuditLog.query()
      .where('action', 'employee.created')
      .where('target_id', data.id)
      .firstOrFail()
    assert.notInclude(JSON.stringify(log.afterData), '3000000')
  })

  test('other roles cannot write', async ({ client }) => {
    const org = await createHrOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const report = await createEmployee(org, { managerId: manager.employee!.id })
    const body = { firstName: 'Nouveau', lastName: 'Nom' }

    await expectStatus(orgCall(client, 'POST', '/employees', manager, org).json(body), 403)
    await expectStatus(
      orgCall(client, 'PATCH', `/employees/${report.id}`, manager, org).json(body),
      403
    )
    await expectStatus(orgCall(client, 'DELETE', `/employees/${report.id}`, manager, org), 403)
  })

  test('validates input, uniqueness and references', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    await createEmployee(org, { email: 'pris@doztra.test', employeeNumber: 'K-1' })
    const foreignManager = await createEmployee(other)
    const foreignDepartment = await createDepartment(other)
    const base = { firstName: 'Ibrahima', lastName: 'Barry' }
    const post = (extra: Record<string, unknown>) =>
      orgCall(client, 'POST', '/employees', owner, org).json({ ...base, ...extra })

    await expectStatus(post({ firstName: 'x' }), 422)
    await expectStatus(post({ baseSalary: -1 }), 422)
    const email = await expectStatus(post({ email: 'PRIS@doztra.test' }), 409)
    assert.equal(errorOf(email).details[0].field, 'email')
    const number = await expectStatus(post({ employeeNumber: 'K-1' }), 409)
    assert.equal(errorOf(number).details[0].field, 'employeeNumber')
    await expectStatus(post({ managerId: foreignManager.id }), 422)
    await expectStatus(post({ departmentId: foreignDepartment.id }), 422)
  })

  test('enforces the plan quota, ignoring terminated employees', async ({ client, assert }) => {
    const org = await createHrOrganization('Doztra', 2)
    const owner = await hrSession(client, org, ['owner'])
    const leaver = await createEmployee(org, { status: 'terminated' })
    const active = await createEmployee(org)
    const body = { firstName: 'Quota', lastName: 'Atteint' }

    const refused = await expectStatus(
      orgCall(client, 'POST', '/employees', owner, org).json(body),
      403
    )
    assert.equal(errorOf(refused).code, 'E_QUOTA_EXCEEDED')
    await expectStatus(
      orgCall(client, 'POST', '/employees', owner, org).json({ ...body, status: 'terminated' }),
      201
    )
    const reactivated = await expectStatus(
      orgCall(client, 'PATCH', `/employees/${leaver.id}`, owner, org).json({ status: 'active' }),
      403
    )
    assert.equal(errorOf(reactivated).code, 'E_QUOTA_EXCEEDED')

    await expectStatus(orgCall(client, 'DELETE', `/employees/${active.id}`, owner, org), 204)
    await expectStatus(
      orgCall(client, 'PATCH', `/employees/${leaver.id}`, owner, org).json({ status: 'active' }),
      200
    )
  })

  test('refuses hierarchy cycles', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const top = await createEmployee(org)
    const middle = await createEmployee(org, { managerId: top.id })
    const bottom = await createEmployee(org, { managerId: middle.id })
    const patch = (managerId: string) =>
      orgCall(client, 'PATCH', `/employees/${top.id}`, owner, org).json({ managerId })

    assert.equal(errorOf(await expectStatus(patch(top.id), 422)).code, 'E_HIERARCHY_CYCLE')
    assert.equal(errorOf(await expectStatus(patch(bottom.id), 422)).code, 'E_HIERARCHY_CYCLE')
  })

  test('another organization is 404', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const foreign = await createEmployee(other, { firstName: 'Intact' })

    await expectStatus(
      orgCall(client, 'PATCH', `/employees/${foreign.id}`, owner, org).json({ firstName: 'Volé' }),
      404
    )
    await expectStatus(orgCall(client, 'DELETE', `/employees/${foreign.id}`, owner, org), 404)
    await expectStatus(orgCall(client, 'POST', `/employees/${foreign.id}/restore`, owner, org), 404)
    await expectStatus(orgCall(client, 'GET', `/employees/${foreign.id}/salary`, owner, org), 404)
    await foreign.refresh()
    assert.equal(foreign.firstName, 'Intact')
  })
})

test.group('End of employment and deletion', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('termination removes roles and moves reports up', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const boss = await createEmployee(org)
    const leaving = await hrSession(client, org, ['manager'], { managerId: boss.id })
    const report = await createEmployee(org, { managerId: leaving.employee!.id })
    const department = await createDepartment(org)
    await department.merge({ managerId: leaving.employee!.id }).save()

    const response = await expectStatus(
      orgCall(client, 'PATCH', `/employees/${leaving.employee!.id}`, owner, org).json({
        status: 'terminated',
      }),
      200
    )
    assert.equal(response.body().data.endDate, DateTime.utc().toISODate())
    await report.refresh()
    await department.refresh()
    assert.equal(report.managerId, boss.id)
    assert.isNull(department.managerId)
    assert.lengthOf(await UserRole.query().where('user_id', leaving.user.id), 0)
    await expectStatus(orgCall(client, 'GET', '/employees', leaving, org), 403)
  })

  test('protects owners and the acting user', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const admin = await hrSession(client, org, ['hr_admin'])
    const terminate = (who: typeof owner, id: string) =>
      orgCall(client, 'PATCH', `/employees/${id}`, who, org).json({ status: 'terminated' })

    await expectStatus(terminate(admin, owner.employee!.id), 403)
    await expectStatus(terminate(owner, owner.employee!.id), 403)
    await owner.employee!.refresh()
    assert.equal(owner.employee!.status, 'active')
    assert.lengthOf(await UserRole.query().where('user_id', owner.user.id), 1)
  })

  test('deletes softly and restores', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const target = await createEmployee(org, { email: 'retour@doztra.test' })
    const path = `/employees/${target.id}`

    await expectStatus(orgCall(client, 'DELETE', path, owner, org), 204)
    await target.refresh()
    assert.isNotNull(target.deletedAt)
    await expectStatus(orgCall(client, 'GET', path, owner, org), 404)

    await createEmployee(org, { email: 'retour@doztra.test' }).then(async (replacement) => {
      const conflict = await expectStatus(
        orgCall(client, 'POST', `${path}/restore`, owner, org),
        409
      )
      assert.equal(errorOf(conflict).details[0].field, 'email')
      await replacement.merge({ email: null }).save()
    })
    await expectStatus(orgCall(client, 'POST', `${path}/restore`, owner, org), 200)
    await expectStatus(orgCall(client, 'GET', path, owner, org), 200)
  })
})

test.group('Account links', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('creating an organization gives its owner a linked record', async ({ client, assert }) => {
    const user = await createUser({ emailVerifiedAt: DateTime.now(), fullName: 'Awa Marie Keita' })
    const { accessToken } = await apiLogin(client, user.email)
    const created = await expectStatus(
      client.post('/api/v1/organizations').bearerToken(accessToken).json({ name: 'Keita SA' }),
      201
    )
    const organizationId = created.body().data.id

    const me = await expectStatus(
      client.get('/api/v1/me').bearerToken(accessToken).header('X-Organization-Id', organizationId),
      200
    )
    const { employee } = me.body().data
    assert.equal(employee.firstName, 'Awa')
    assert.equal(employee.lastName, 'Marie Keita')
    const row = await Employee.findOrFail(employee.id)
    assert.equal(row.userId, user.id)
  })

  test('an invitation links the account to the record', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const target = await createEmployee(org)
    const email = 'lie@doztra.test'

    const invited = await expectStatus(
      orgCall(client, 'POST', '/invitations', owner, org).json({
        email: 'autre@doztra.test',
        role: 'employee',
        employeeId: target.id,
      }),
      201
    )
    assert.equal(invited.body().data.employeeId, target.id)
    await expectStatus(
      orgCall(client, 'POST', '/invitations', owner, org).json({
        email: 'lie2@doztra.test',
        role: 'employee',
        employeeId: owner.employee!.id,
      }),
      409
    )

    const { invitation, token } = await createInvitation(org, { email })
    await invitation.merge({ employeeId: target.id }).save()
    await expectStatus(
      client.request(`/api/v1/auth/invitations/${token}/accept`, 'POST').json({
        password: 'Konakry-Rh-2026',
        password_confirmation: 'Konakry-Rh-2026',
      }),
      200
    )
    await target.refresh()
    assert.isNotNull(target.userId)
  })

  test('an invitation cannot target a record of another organization', async ({ client }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const foreign = await createEmployee(other)
    await expectStatus(
      orgCall(client, 'POST', '/invitations', owner, org).json({
        email: 'x@doztra.test',
        role: 'employee',
        employeeId: foreign.id,
      }),
      422
    )
  })
})
