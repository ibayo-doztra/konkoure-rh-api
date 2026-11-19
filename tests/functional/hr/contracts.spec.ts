import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import drive from '@adonisjs/drive/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import Contract from '#models/contract'
import { errorOf, expectStatus } from '#tests/helpers/http'
import {
  createContract,
  createEmployee,
  createHrOrganization,
  hrSession,
  orgCall,
} from '#tests/helpers/hr'

const ids = (response: { body(): { data: Array<{ id: string }> } }) =>
  response.body().data.map((row) => row.id)

const auditActions = async (organizationId: string, action: string) =>
  AuditLog.query().where('organization_id', organizationId).where('action', action)

const today = () => DateTime.now().setZone('Africa/Conakry').toISODate()

test.group('GET /org/contracts', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('scopes contracts and salaries by role', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const outsider = await createEmployee(org)
    const money = { salary: '2500000', notes: 'Prime négociée' }
    const own = await createContract(manager.employee!, money)
    const team = await createContract(report.employee!, money)
    const unrelated = await createContract(outsider, money)
    const foreign = await createContract(await createEmployee(other), money)
    const get = (who: { accessToken: string }) =>
      expectStatus(orgCall(client, 'GET', '/contracts', who, org), 200)

    const all = await get(owner)
    assert.sameMembers(ids(all), [own.id, team.id, unrelated.id])
    assert.notInclude(ids(all), foreign.id)
    assert.equal(all.body().data[0].salary, 2500000)

    const managed = await get(manager)
    assert.sameMembers(ids(managed), [own.id, team.id])
    const rows = managed.body().data as Array<Record<string, unknown>>
    const teamRow = rows.find((row) => row.id === team.id)!
    assert.notProperty(teamRow, 'salary')
    assert.notProperty(teamRow, 'notes')
    assert.equal(rows.find((row) => row.id === own.id)!.salary, 2500000)
    assert.notProperty(teamRow, 'documentPath')

    const mine = await get(report)
    assert.deepEqual(ids(mine), [team.id])
    assert.equal(mine.body().data[0].salary, 2500000)
  })

  test('journals the salaries it returns', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const paid = await createContract(await createEmployee(org), { salary: '900000' })
    await createContract(await createEmployee(org))

    await expectStatus(orgCall(client, 'GET', '/contracts', owner, org), 200)

    const [entry] = await auditActions(org.id, 'salary.viewed')
    assert.deepEqual(entry.afterData, { contractIds: [paid.id] })
  })

  test('filters by employee, status and type', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const employee = await createEmployee(org)
    const target = await createContract(employee, { type: 'cdd', status: 'active' })
    await createContract(employee, { type: 'cdi' })
    await createContract(await createEmployee(org), { type: 'cdd' })
    const get = (query: string) =>
      expectStatus(orgCall(client, 'GET', `/contracts?${query}`, owner, org), 200)

    const both = `filter[employeeId]=${employee.id}&filter[type]=cdd`
    assert.deepEqual(ids(await get(both)), [target.id])
    assert.deepEqual(ids(await get('filter[status]=active')), [target.id])
    await expectStatus(orgCall(client, 'GET', '/contracts?filter[type]=x', owner, org), 422)
  })

  test('refuses roles without access to contracts', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const recruiter = await hrSession(client, org, ['recruiter'])
    const response = await expectStatus(orgCall(client, 'GET', '/contracts', recruiter, org), 403)
    assert.equal(errorOf(response).code, 'E_FORBIDDEN')
  })
})

test.group('POST /org/contracts', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('creates a draft in GNF and keeps the salary out of the journal', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const employee = await createEmployee(org)

    const response = await expectStatus(
      orgCall(client, 'POST', '/contracts', owner, org).json({
        employeeId: employee.id,
        type: 'cdd',
        startDate: '2026-02-01',
        endDate: '2026-12-31',
        trialPeriodEnd: '2026-03-01',
        salary: 3000000,
        weeklyHours: 40,
      }),
      201
    )
    assert.deepInclude(response.body().data, {
      employeeId: employee.id,
      type: 'cdd',
      status: 'draft',
      startDate: '2026-02-01',
      endDate: '2026-12-31',
      trialPeriodEnd: '2026-03-01',
      salary: 3000000,
      currency: 'GNF',
      weeklyHours: 40,
      hasDocument: false,
    })

    const [entry] = await auditActions(org.id, 'contract.created')
    assert.notInclude(JSON.stringify(entry.afterData), '3000000')
  })

  test('allows one active contract per employee, none after departure', async ({
    client,
    assert,
  }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const employee = await createEmployee(org)
    const leaver = await createEmployee(org, { status: 'terminated' })
    await createContract(employee, { status: 'active' })
    const create = (employeeId: string) =>
      expectStatus(
        orgCall(client, 'POST', '/contracts', owner, org).json({
          employeeId,
          type: 'cdi',
          startDate: '2026-02-01',
          status: 'active',
        }),
        409
      )

    assert.equal(errorOf(await create(employee.id)).details[0].rule, 'activeExists')
    assert.equal(errorOf(await create(leaver.id)).details[0].rule, 'employeeTerminated')
  })

  test('refuses other roles and employees of another organization', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const foreign = await createEmployee(other)
    const body = { employeeId: foreign.id, type: 'cdi', startDate: '2026-02-01' }

    await expectStatus(orgCall(client, 'POST', '/contracts', manager, org).json(body), 403)
    const response = await expectStatus(
      orgCall(client, 'POST', '/contracts', owner, org).json(body),
      422
    )
    assert.equal(errorOf(response).details[0].field, 'employeeId')
    assert.lengthOf(await Contract.query().where('employee_id', foreign.id), 0)
  })

  test('validates the input', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const employee = await createEmployee(org)
    const post = (body: Record<string, unknown>) =>
      expectStatus(orgCall(client, 'POST', '/contracts', owner, org).json(body), 422)

    const invalid = await post({ type: 'interim', currency: 'XOF', status: 'terminated' })
    assert.includeMembers(
      errorOf(invalid).details.map((detail) => detail.field),
      ['employeeId', 'type', 'startDate', 'currency', 'status']
    )
    const base = { employeeId: employee.id, type: 'cdd', startDate: '2026-02-01' }
    const dates = await post({ ...base, endDate: '2026-01-01' })
    assert.equal(errorOf(dates).details[0].field, 'endDate')
    const trial = await post({ ...base, endDate: '2026-03-01', trialPeriodEnd: '2026-04-01' })
    assert.equal(errorOf(trial).details[0].field, 'trialPeriodEnd')
  })
})

test.group('/org/contracts/:id', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('shows a contract to HR only and journals the salary', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['hr_admin'])
    const self = await hrSession(client, org, ['employee'])
    const contract = await createContract(self.employee!, { salary: '1200000' })
    const foreign = await createContract(await createEmployee(other))

    const response = await expectStatus(
      orgCall(client, 'GET', `/contracts/${contract.id}`, owner, org),
      200
    )
    assert.equal(response.body().data.salary, 1200000)
    const [entry] = await auditActions(org.id, 'salary.viewed')
    assert.equal(entry.targetId, contract.id)

    await expectStatus(orgCall(client, 'GET', `/contracts/${contract.id}`, self, org), 403)
    await expectStatus(orgCall(client, 'GET', `/contracts/${foreign.id}`, owner, org), 404)
    await expectStatus(orgCall(client, 'GET', '/contracts/not-a-uuid', owner, org), 422)
  })

  test('updates a contract and activates it', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const employee = await createEmployee(org)
    const contract = await createContract(employee)
    const foreign = await createContract(await createEmployee(other))
    const path = `/contracts/${contract.id}`

    const response = await expectStatus(
      orgCall(client, 'PATCH', path, owner, org).json({ status: 'active', notes: null }),
      200
    )
    assert.equal(response.body().data.status, 'active')

    await createContract(employee).then(async (draft) => {
      const refused = await expectStatus(
        orgCall(client, 'PATCH', `/contracts/${draft.id}`, owner, org).json({ status: 'active' }),
        409
      )
      assert.equal(errorOf(refused).details[0].rule, 'activeExists')
    })
    await expectStatus(orgCall(client, 'PATCH', path, manager, org).json({ notes: 'x' }), 403)
    await expectStatus(
      orgCall(client, 'PATCH', `/contracts/${foreign.id}`, owner, org).json({ notes: 'x' }),
      404
    )
    await expectStatus(
      orgCall(client, 'PATCH', path, owner, org).json({ status: 'terminated' }),
      422
    )
    await expectStatus(
      orgCall(client, 'PATCH', path, owner, org).json({ endDate: '2020-01-01' }),
      422
    )
  })

  test('freezes a terminated contract', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const contract = await createContract(await createEmployee(org), { status: 'terminated' })

    const response = await expectStatus(
      orgCall(client, 'PATCH', `/contracts/${contract.id}`, owner, org).json({ notes: 'x' }),
      409
    )
    assert.equal(errorOf(response).details[0].rule, 'terminated')
  })

  test('soft deletes a contract, freeing the active slot', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const employee = await createEmployee(org)
    const contract = await createContract(employee, { status: 'active' })
    const foreign = await createContract(await createEmployee(other))
    const path = `/contracts/${contract.id}`

    await expectStatus(orgCall(client, 'DELETE', path, manager, org), 403)
    await expectStatus(orgCall(client, 'DELETE', `/contracts/${foreign.id}`, owner, org), 404)
    await expectStatus(orgCall(client, 'DELETE', path, owner, org), 204)

    await expectStatus(orgCall(client, 'GET', path, owner, org), 404)
    const row = await Contract.findOrFail(contract.id)
    assert.isNotNull(row.deletedAt)
    await createContract(employee, { status: 'active' })
    assert.lengthOf(await auditActions(org.id, 'contract.deleted'), 1)
  })

  test('hides the contracts of a deleted employee', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const employee = await createEmployee(org)
    const contract = await createContract(employee)

    await expectStatus(orgCall(client, 'DELETE', `/employees/${employee.id}`, owner, org), 204)

    const list = await expectStatus(orgCall(client, 'GET', '/contracts', owner, org), 200)
    assert.notInclude(ids(list), contract.id)
    await expectStatus(orgCall(client, 'GET', `/contracts/${contract.id}`, owner, org), 404)
  })
})

test.group('POST /org/contracts/:id/terminate', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('closes the contract today by default, or on the given date', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const first = await createContract(await createEmployee(org), { status: 'active' })
    const second = await createContract(await createEmployee(org), { status: 'suspended' })
    const terminate = (id: string, body = {}) =>
      expectStatus(
        orgCall(client, 'POST', `/contracts/${id}/terminate`, owner, org).json(body),
        200
      )

    const closed = await terminate(first.id)
    assert.deepInclude(closed.body().data, { status: 'terminated', endDate: today() })
    const dated = await terminate(second.id, { endDate: '2026-06-30' })
    assert.equal(dated.body().data.endDate, '2026-06-30')
    assert.lengthOf(await auditActions(org.id, 'contract.terminated'), 2)
  })

  test('refuses invalid states, dates, roles and foreign contracts', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const draft = await createContract(await createEmployee(org))
    const active = await createContract(await createEmployee(org), { status: 'active' })
    const foreign = await createContract(await createEmployee(other), { status: 'active' })
    const post = (id: string, who = owner, body = {}) =>
      orgCall(client, 'POST', `/contracts/${id}/terminate`, who, org).json(body)

    const refused = await expectStatus(post(draft.id), 409)
    assert.equal(errorOf(refused).details[0].rule, 'notTerminable')
    await expectStatus(post(active.id, owner, { endDate: '2020-01-01' }), 422)
    await expectStatus(post(active.id, manager), 403)
    await expectStatus(post(foreign.id), 404)
  })

  test('ending an employment closes the active contract', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const employee = await createEmployee(org)
    const future = await createEmployee(org)
    const draftOfEmployee = await createContract(employee)
    const active = await createContract(employee, { status: 'active' })
    const notStarted = await createContract(future, {
      status: 'active',
      startDate: DateTime.now().plus({ months: 2 }),
    })
    const leave = (id: string) =>
      expectStatus(
        orgCall(client, 'PATCH', `/employees/${id}`, owner, org).json({ status: 'terminated' }),
        200
      )

    await leave(employee.id)
    await leave(future.id)

    await active.refresh()
    assert.equal(active.status, 'terminated')
    assert.equal(active.endDate?.toISODate(), today())
    await draftOfEmployee.refresh()
    assert.equal(draftOfEmployee.status, 'draft')
    await notStarted.refresh()
    assert.equal(notStarted.endDate?.toISODate(), notStarted.startDate.toISODate())
    assert.lengthOf(await auditActions(org.id, 'contract.terminated'), 2)
  })
})

test.group('GET /org/contracts/:id/document', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => {
    drive.fake('s3')
    return () => drive.restore('s3')
  })

  test('gives HR and the employee a journaled signed link', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const self = await hrSession(client, org, ['employee'])
    const colleague = await hrSession(client, org, ['employee'])
    const documentPath = `${org.id}/contracts/${self.employee!.id}/contrat.pdf`
    const contract = await createContract(self.employee!, { documentPath })
    const empty = await createContract(self.employee!)
    const foreign = await createContract(await createEmployee(other), { documentPath: 'x.pdf' })
    const get = (id: string, who: { accessToken: string }) =>
      orgCall(client, 'GET', `/contracts/${id}/document`, who, org)

    for (const who of [owner, self]) {
      const response = await expectStatus(get(contract.id, who), 200)
      assert.include(response.body().data.url, 'contrat.pdf')
      assert.equal(response.body().data.expiresIn, 900)
    }
    assert.lengthOf(await auditActions(org.id, 'sensitive_document.viewed'), 2)

    await expectStatus(get(contract.id, colleague), 403)
    await expectStatus(get(empty.id, owner), 404)
    await expectStatus(get(foreign.id, owner), 404)
  })
})

test.group('GET /org/employees filter[contractType]', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('matches the active contract, for viewers of private data', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const recruiter = await hrSession(client, org, ['recruiter'])
    const cdd = await createEmployee(org)
    const draftOnly = await createEmployee(org)
    await createContract(cdd, { type: 'cdd', status: 'active' })
    await createContract(draftOnly, { type: 'cdd' })
    const path = '/employees?filter[contractType]=cdd&perPage=100'

    const filtered = await expectStatus(orgCall(client, 'GET', path, owner, org), 200)
    assert.deepEqual(ids(filtered), [cdd.id])
    const ignored = await expectStatus(orgCall(client, 'GET', path, recruiter, org), 200)
    assert.include(ids(ignored), draftOnly.id)
    await expectStatus(orgCall(client, 'GET', '/employees?filter[contractType]=x', owner, org), 422)
  })
})
