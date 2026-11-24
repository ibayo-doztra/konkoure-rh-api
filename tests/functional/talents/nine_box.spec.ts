import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import AuditLog from '#models/audit_log'
import PerformanceReview from '#models/performance_review'
import type Organization from '#models/organization'
import { levelOf } from '#modules/talents/services/nine_box_service'
import { errorOf, expectStatus } from '#tests/helpers/http'
import { createEmployee, createHrOrganization, hrSession, orgCall } from '#tests/helpers/hr'
import { createCycle } from '#tests/helpers/performance'
import { createRecruitingOrganization } from '#tests/helpers/recruitment'

interface Placement {
  employeeId: string
  performanceScore: number | null
  potentialScore: number | null
}

interface Cell {
  performance: string
  potential: string
  employees: Placement[]
}

function createReview(
  organization: Organization,
  employeeId: string,
  overrides: Partial<{
    cycleId: string
    status: PerformanceReview['status']
    managerScore: number
    performanceScore: number
    potentialScore: number
  }> = {}
) {
  return PerformanceReview.create({ organizationId: organization.id, employeeId, ...overrides })
}

const cellOf = (cells: Cell[], performance: string, potential: string) =>
  cells.find((cell) => cell.performance === performance && cell.potential === potential)!

test.group('levelOf', () => {
  test('places a score on an axis with the thresholds', ({ assert }) => {
    const thresholds = { lowMax: 2, mediumMax: 3 }
    assert.deepEqual(
      [1, 2, 3, 4, 5].map((score) => levelOf(score, thresholds)),
      ['low', 'low', 'medium', 'high', 'high']
    )
    assert.equal(levelOf(3, { lowMax: 3, mediumMax: 4 }), 'low')
  })
})

test.group('PATCH /org/performance/reviews/:id/talent', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('HR scores a validated or signed evaluation', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const hr = await hrSession(client, org, ['hr_admin'])
    const employee = await hrSession(client, org, ['employee'])
    const cycle = await createCycle(org, { status: 'open' })
    const review = await createReview(org, employee.employee!.id, {
      cycleId: cycle.id,
      status: 'signed',
      managerScore: 4,
    })
    const patch = (body: Record<string, unknown>) =>
      orgCall(client, 'PATCH', `/performance/reviews/${review.id}/talent`, hr, org).json(body)

    const scored = await expectStatus(patch({ performanceScore: 5, potentialScore: 3 }), 200)
    assert.deepInclude(scored.body().data, { performanceScore: 5, potentialScore: 3 })
    const cleared = await expectStatus(patch({ performanceScore: null }), 200)
    assert.deepInclude(cleared.body().data, { performanceScore: null, potentialScore: 3 })
    assert.isNotNull(
      await AuditLog.query()
        .where('target_id', review.id)
        .where('action', 'review.talent_scored')
        .first()
    )

    // The evaluated employee never sees the 9-box scores.
    const own = await expectStatus(
      orgCall(client, 'GET', `/performance/reviews/${review.id}`, employee, org),
      200
    )
    assert.deepInclude(own.body().data, { performanceScore: null, potentialScore: null })
  })

  test('refuses unfinished evaluations, other roles and invalid scores', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization('Mienne')
    const other = await createRecruitingOrganization('Autre')
    const hr = await hrSession(client, org, ['owner'])
    const manager = await hrSession(client, org, ['manager'])
    const report = await createEmployee(org, { managerId: manager.employee!.id })
    const submitted = await createReview(org, report.id, { status: 'submitted' })
    const validated = await createReview(org, report.id, { status: 'validated' })
    const stranger = await createEmployee(other)
    const foreign = await createReview(other, stranger.id, {
      status: 'validated',
    })
    const ownReview = await createReview(org, hr.employee!.id, { status: 'validated' })
    const patch = (id: string, who: { accessToken: string }, body: Record<string, unknown>) =>
      orgCall(client, 'PATCH', `/performance/reviews/${id}/talent`, who, org).json(body)

    const conflict = await expectStatus(patch(submitted.id, hr, { potentialScore: 3 }), 409)
    assert.equal(errorOf(conflict).details[0].rule, 'notValidated')
    await expectStatus(patch(validated.id, manager, { potentialScore: 3 }), 403)
    await expectStatus(patch(ownReview.id, hr, { potentialScore: 3 }), 403)
    await expectStatus(patch(foreign.id, hr, { potentialScore: 3 }), 404)
    await expectStatus(patch(validated.id, hr, { potentialScore: 6 }), 422)

    const trial = await createHrOrganization('Essai')
    const owner = await hrSession(client, trial, ['owner'])
    const trialEmployee = await createEmployee(trial)
    const trialReview = await createReview(trial, trialEmployee.id, {
      status: 'validated',
    })
    const refused = await expectStatus(
      orgCall(client, 'PATCH', `/performance/reviews/${trialReview.id}/talent`, owner, trial).json({
        potentialScore: 3,
      }),
      403
    )
    assert.equal(errorOf(refused).code, 'E_MODULE_NOT_INCLUDED')
  })
})

test.group('GET /org/talents/9box', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('places evaluations of the cycle in the grid', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const hr = await hrSession(client, org, ['hr_admin'], { linked: false })
    const cycle = await createCycle(org, { status: 'closed' })
    const previous = await createCycle(org, { name: '2025', status: 'closed' })
    const star = await createEmployee(org, { lastName: 'Barry' })
    const signed = await createEmployee(org, { lastName: 'Conde' })
    const pending = await createEmployee(org, { lastName: 'Diallo' })
    const noPotential = await createEmployee(org, { lastName: 'Keita' })
    await createReview(org, star.id, {
      cycleId: cycle.id,
      status: 'signed',
      managerScore: 2,
      performanceScore: 5,
      potentialScore: 4,
    })
    await createReview(org, signed.id, {
      cycleId: cycle.id,
      status: 'signed',
      managerScore: 3,
      potentialScore: 1,
    })
    // Validated, not signed: the manager score does not count, nor any other cycle.
    await createReview(org, pending.id, {
      cycleId: cycle.id,
      status: 'validated',
      managerScore: 5,
      potentialScore: 5,
    })
    await createReview(org, noPotential.id, {
      cycleId: cycle.id,
      status: 'signed',
      managerScore: 4,
    })
    await createReview(org, star.id, {
      cycleId: previous.id,
      performanceScore: 1,
      potentialScore: 1,
    })

    const response = await expectStatus(
      orgCall(client, 'GET', `/talents/9box?cycleId=${cycle.id}`, hr, org),
      200
    )
    const box = response.body().data
    assert.deepEqual(box.thresholds, { lowMax: 2, mediumMax: 3 })
    assert.lengthOf(box.cells, 9)
    assert.deepEqual(
      cellOf(box.cells, 'high', 'high').employees.map((row: Placement) => row.employeeId),
      [star.id]
    )
    assert.deepInclude(cellOf(box.cells, 'medium', 'low').employees[0], {
      employeeId: signed.id,
      performanceScore: 3,
      potentialScore: 1,
    })
    assert.deepEqual(
      box.unplaced.map((row: Placement) => row.employeeId),
      [pending.id, noPotential.id]
    )
  })

  test('uses the thresholds of the organization settings', async ({ client, assert }) => {
    const org = await createRecruitingOrganization()
    const owner = await hrSession(client, org, ['owner'], { linked: false })
    const cycle = await createCycle(org)
    const employee = await createEmployee(org)
    await createReview(org, employee.id, {
      cycleId: cycle.id,
      status: 'validated',
      performanceScore: 3,
      potentialScore: 4,
    })

    await expectStatus(
      orgCall(client, 'PUT', '/settings', owner, org).json({
        talents: { nineBox: { lowMax: 3, mediumMax: 3 } },
      }),
      422
    )
    await expectStatus(
      orgCall(client, 'PUT', '/settings', owner, org).json({
        talents: { nineBox: { lowMax: 3, mediumMax: 4 } },
      }),
      200
    )
    const response = await expectStatus(
      orgCall(client, 'GET', `/talents/9box?cycleId=${cycle.id}`, owner, org),
      200
    )
    const box = response.body().data
    assert.deepEqual(box.thresholds, { lowMax: 3, mediumMax: 4 })
    assert.lengthOf(cellOf(box.cells, 'low', 'medium').employees, 1)
  })

  test('a manager sees the team; employees and other tenants are refused', async ({
    client,
    assert,
  }) => {
    const org = await createRecruitingOrganization('Mienne')
    const other = await createRecruitingOrganization('Autre')
    const manager = await hrSession(client, org, ['manager'])
    const employee = await hrSession(client, org, ['employee'])
    const report = await createEmployee(org, { managerId: manager.employee!.id })
    const outsider = await createEmployee(org)
    const cycle = await createCycle(org)
    const foreignCycle = await createCycle(other)
    for (const id of [report.id, outsider.id, manager.employee!.id]) {
      await createReview(org, id, { cycleId: cycle.id, status: 'validated' })
    }

    const team = await expectStatus(
      orgCall(client, 'GET', `/talents/9box?cycleId=${cycle.id}`, manager, org),
      200
    )
    assert.deepEqual(
      team.body().data.unplaced.map((row: Placement) => row.employeeId),
      [report.id]
    )
    await expectStatus(
      orgCall(client, 'GET', `/talents/9box?cycleId=${cycle.id}`, employee, org),
      403
    )
    await expectStatus(
      orgCall(client, 'GET', `/talents/9box?cycleId=${foreignCycle.id}`, manager, org),
      404
    )
    await expectStatus(orgCall(client, 'GET', '/talents/9box', manager, org), 422)
  })
})
