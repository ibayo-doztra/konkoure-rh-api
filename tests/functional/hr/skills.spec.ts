import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import EmployeeSkill from '#models/employee_skill'
import { errorOf, expectStatus } from '#tests/helpers/http'
import {
  createEmployee,
  createHrOrganization,
  createSkill,
  hrSession,
  orgCall,
} from '#tests/helpers/hr'

test.group('/org/skills', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('lists the catalog of the organization for HR and managers', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'])
    const skill = await createSkill(org, 'Comptabilité')
    await createSkill(other, 'Soudure')

    const response = await expectStatus(orgCall(client, 'GET', '/skills', manager, org), 200)
    assert.deepEqual(
      response.body().data.map((row: { id: string }) => row.id),
      [skill.id]
    )
    assert.equal(response.body().meta.total, 1)
    await expectStatus(orgCall(client, 'GET', '/skills', employee, org), 403)
  })

  test('creates a skill with a unique name', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    await createSkill(org, 'Excel')
    const post = (who: { accessToken: string }, body: Record<string, unknown>) =>
      orgCall(client, 'POST', '/skills', who, org).json(body)

    const created = await expectStatus(post(owner, { name: 'Python', category: 'Tech' }), 201)
    assert.deepInclude(created.body().data, { name: 'Python', category: 'Tech' })

    const duplicate = await expectStatus(post(owner, { name: 'EXCEL' }), 409)
    assert.equal(errorOf(duplicate).details[0].rule, 'taken')
    await expectStatus(post(manager, { name: 'Java' }), 403)
    await expectStatus(post(owner, { name: 'x' }), 422)
  })

  test('updates a skill', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['hr_admin'])
    const manager = await hrSession(client, org, ['manager'])
    const skill = await createSkill(org, 'Excel')
    await createSkill(org, 'Word')
    const foreign = await createSkill(other, 'Soudure')
    const patch = (id: string, who: { accessToken: string }, body: Record<string, unknown>) =>
      orgCall(client, 'PATCH', `/skills/${id}`, who, org).json(body)

    const updated = await expectStatus(patch(skill.id, owner, { category: 'Bureautique' }), 200)
    assert.deepInclude(updated.body().data, { name: 'Excel', category: 'Bureautique' })

    await expectStatus(patch(skill.id, owner, { name: 'word' }), 409)
    await expectStatus(patch(skill.id, manager, { category: null }), 403)
    await expectStatus(patch(foreign.id, owner, { category: null }), 404)
    await expectStatus(patch(skill.id, owner, { name: 'x' }), 422)
  })

  test('deletes a skill with its assessments', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const skill = await createSkill(org)
    const foreign = await createSkill(other)
    const employee = await createEmployee(org)
    await EmployeeSkill.create({
      organizationId: org.id,
      employeeId: employee.id,
      skillId: skill.id,
      level: 3,
    })

    await expectStatus(orgCall(client, 'DELETE', `/skills/${skill.id}`, manager, org), 403)
    await expectStatus(orgCall(client, 'DELETE', `/skills/${foreign.id}`, owner, org), 404)
    await expectStatus(orgCall(client, 'DELETE', `/skills/${skill.id}`, owner, org), 204)

    assert.lengthOf(await EmployeeSkill.query().where('skill_id', skill.id), 0)
    const entry = await AuditLog.query()
      .where('organization_id', org.id)
      .where('action', 'skill.deleted')
      .firstOrFail()
    assert.equal(entry.beforeData?.assessments, 1)
  })
})

test.group('/org/employees/:id/skills', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('replaces the whole set of skills', async ({ client, assert }) => {
    const org = await createHrOrganization()
    const owner = await hrSession(client, org, ['owner'])
    const employee = await createEmployee(org)
    const excel = await createSkill(org, 'Excel')
    const python = await createSkill(org, 'Python')
    const put = (skills: Array<Record<string, unknown>>) =>
      expectStatus(
        orgCall(client, 'PUT', `/employees/${employee.id}/skills`, owner, org).json({ skills }),
        200
      )

    await put([{ skillId: excel.id, level: 2 }])
    const response = await put([
      { skillId: python.id, level: 5, assessedAt: '2026-03-01' },
      { skillId: excel.id, level: 4 },
    ])
    assert.deepEqual(response.body().data, [
      { skillId: excel.id, name: 'Excel', category: null, level: 4, assessedAt: null },
      { skillId: python.id, name: 'Python', category: null, level: 5, assessedAt: '2026-03-01' },
    ])

    const cleared = await put([])
    assert.lengthOf(cleared.body().data, 0)
    assert.lengthOf(await EmployeeSkill.query().where('employee_id', employee.id), 0)
  })

  test('refuses bad input, other roles and foreign references', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const employee = await createEmployee(org, { managerId: manager.employee!.id })
    const foreignEmployee = await createEmployee(other)
    const skill = await createSkill(org)
    const foreignSkill = await createSkill(other)
    const put = (id: string, who: { accessToken: string }, skills: unknown[]) =>
      orgCall(client, 'PUT', `/employees/${id}/skills`, who, org).json({ skills })
    const valid = [{ skillId: skill.id, level: 3 }]

    await expectStatus(put(employee.id, manager, valid), 403)
    await expectStatus(put(foreignEmployee.id, owner, valid), 404)
    const unknown = await expectStatus(
      put(employee.id, owner, [{ skillId: foreignSkill.id, level: 3 }]),
      422
    )
    assert.equal(errorOf(unknown).details[0].field, 'skills')
    await expectStatus(put(employee.id, owner, [{ skillId: skill.id, level: 6 }]), 422)
    await expectStatus(put(employee.id, owner, [...valid, ...valid]), 422)
    assert.lengthOf(await EmployeeSkill.query().where('employee_id', employee.id), 0)
  })

  test('shows skills to HR, the team manager and the employee', async ({ client, assert }) => {
    const org = await createHrOrganization('Mienne')
    const other = await createHrOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const self = await hrSession(client, org, ['employee'], { managerId: manager.employee!.id })
    const colleague = await hrSession(client, org, ['employee'])
    const otherManager = await hrSession(client, org, ['manager'])
    const recruiter = await hrSession(client, org, ['recruiter'])
    const foreign = await createEmployee(other)
    const skill = await createSkill(org, 'Excel')
    await EmployeeSkill.create({
      organizationId: org.id,
      employeeId: self.employee!.id,
      skillId: skill.id,
      level: 3,
    })
    const get = (who: { accessToken: string }, id = self.employee!.id) =>
      orgCall(client, 'GET', `/employees/${id}/skills`, who, org)

    for (const who of [owner, manager, self]) {
      const response = await expectStatus(get(who), 200)
      assert.equal(response.body().data[0].level, 3)
    }
    for (const who of [colleague, otherManager, recruiter]) await expectStatus(get(who), 403)
    await expectStatus(get(owner, foreign.id), 404)
    await expectStatus(get(owner, 'not-a-uuid'), 422)
  })
})
