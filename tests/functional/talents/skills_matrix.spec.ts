import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import EmployeeSkill from '#models/employee_skill'
import { errorOf, expectStatus } from '#tests/helpers/http'
import {
  createDepartment,
  createEmployee,
  createHrOrganization,
  createSkill,
  hrSession,
  orgCall,
} from '#tests/helpers/hr'
import { createRecruitingOrganization } from '#tests/helpers/recruitment'

interface MatrixRow {
  id: string
  levels: Record<string, number>
}

test.group('/org/talents/skills-matrix', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('shows employees by skills, with filters', async ({ client, assert }) => {
    const org = await createRecruitingOrganization('Mienne')
    const other = await createRecruitingOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'], { linked: false })
    const finance = await createDepartment(org, 'Finance')
    const excel = await createSkill(org, 'Excel')
    const python = await createSkill(org, 'Python')
    await createSkill(other, 'Soudure')
    const aminata = await createEmployee(org, { departmentId: finance.id, lastName: 'Bah' })
    const ibrahima = await createEmployee(org, { lastName: 'Sow' })
    await createEmployee(org, { lastName: 'Parti', status: 'terminated' })
    await createEmployee(other)
    await EmployeeSkill.createMany([
      { organizationId: org.id, employeeId: aminata.id, skillId: excel.id, level: 4 },
      { organizationId: org.id, employeeId: aminata.id, skillId: python.id, level: 2 },
    ])

    const all = await expectStatus(
      orgCall(client, 'GET', '/talents/skills-matrix', owner, org),
      200
    )
    const body = all.body()
    assert.deepEqual(
      body.data.skills.map((skill: { name: string }) => skill.name),
      ['Excel', 'Python']
    )
    assert.deepEqual(
      body.data.employees.map((row: MatrixRow) => row.id),
      [aminata.id, ibrahima.id]
    )
    assert.deepEqual(body.data.employees[0].levels, { [excel.id]: 4, [python.id]: 2 })
    assert.deepEqual(body.data.employees[1].levels, {})
    assert.equal(body.meta.total, 2)

    const filtered = await expectStatus(
      orgCall(
        client,
        'GET',
        `/talents/skills-matrix?filter[departmentId]=${finance.id}&filter[skillId][]=${excel.id}`,
        owner,
        org
      ),
      200
    )
    assert.lengthOf(filtered.body().data.skills, 1)
    assert.deepEqual(
      filtered.body().data.employees.map((row: MatrixRow) => row.levels),
      [{ [excel.id]: 4 }]
    )
  })

  test('a manager reads the team only; an employee is refused', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'])
    const report = await createEmployee(org, { managerId: manager.employee!.id })
    await createEmployee(org)

    const team = await expectStatus(
      orgCall(client, 'GET', '/talents/skills-matrix', manager, org),
      200
    )
    assert.deepEqual(
      team.body().data.employees.map((row: MatrixRow) => row.id),
      [report.id]
    )
    await expectStatus(orgCall(client, 'GET', '/talents/skills-matrix', employee, org), 403)
    const skill = await createSkill(org)
    await expectStatus(
      orgCall(client, 'PUT', '/talents/skills-matrix', manager, org).json({
        entries: [{ employeeId: report.id, skillId: skill.id, level: 3 }],
      }),
      403
    )
  })

  test('sets, changes and removes levels', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['hr_admin'])
    const excel = await createSkill(org, 'Excel')
    const python = await createSkill(org, 'Python')
    const word = await createSkill(org, 'Word')
    const employee = await createEmployee(org)
    await EmployeeSkill.createMany([
      { organizationId: org.id, employeeId: employee.id, skillId: excel.id, level: 2 },
      { organizationId: org.id, employeeId: employee.id, skillId: word.id, level: 3 },
    ])

    const response = await expectStatus(
      orgCall(client, 'PUT', '/talents/skills-matrix', owner, org).json({
        entries: [
          { employeeId: employee.id, skillId: excel.id, level: 5 },
          { employeeId: employee.id, skillId: python.id, level: 1 },
          { employeeId: employee.id, skillId: word.id, level: null },
        ],
      }),
      200
    )
    assert.deepEqual(response.body().data, { updated: 2, removed: 1 })

    const rows = await EmployeeSkill.query().where('employee_id', employee.id).orderBy('level')
    assert.deepEqual(
      rows.map((row) => [row.skillId, row.level]),
      [
        [python.id, 1],
        [excel.id, 5],
      ]
    )
    const audit = await AuditLog.query()
      .where('organization_id', org.id)
      .where('action', 'talents.skills_matrix_updated')
      .firstOrFail()
    assert.lengthOf((audit.afterData as { cells: unknown[] }).cells, 3)
  })

  test('validates entries and refuses records of another organization', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization('Mienne')
    const other = await createRecruitingOrganization('Autre')
    const owner = await hrSession(client, org, ['owner'])
    const skill = await createSkill(org)
    const employee = await createEmployee(org)
    const foreignEmployee = await createEmployee(other)
    const foreignSkill = await createSkill(other)
    const put = (entries: unknown[]) =>
      orgCall(client, 'PUT', '/talents/skills-matrix', owner, org).json({ entries })

    await expectStatus(put([]), 422)
    await expectStatus(put([{ employeeId: employee.id, skillId: skill.id, level: 6 }]), 422)
    const duplicate = await expectStatus(
      put([
        { employeeId: employee.id, skillId: skill.id, level: 2 },
        { employeeId: employee.id, skillId: skill.id, level: 3 },
      ]),
      422
    )
    assert.equal(errorOf(duplicate).details[0].rule, 'distinct')
    await expectStatus(put([{ employeeId: foreignEmployee.id, skillId: skill.id, level: 2 }]), 422)
    await expectStatus(put([{ employeeId: employee.id, skillId: foreignSkill.id, level: 2 }]), 422)
    assert.lengthOf(await EmployeeSkill.query().where('employee_id', employee.id), 0)
  })

  test('the talents module is required', async ({ client, assert }) => {
    const trial = await createHrOrganization('Essai')
    const owner = await hrSession(client, trial, ['owner'])
    const refused = await expectStatus(
      orgCall(client, 'GET', '/talents/skills-matrix', owner, trial),
      403
    )
    assert.equal(errorOf(refused).code, 'E_MODULE_NOT_INCLUDED')
  })
})
