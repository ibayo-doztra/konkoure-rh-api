import { DateTime } from 'luxon'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import type Employee from '#models/employee'
import Goal from '#models/goal'
import type Organization from '#models/organization'
import PerformanceCycle from '#models/performance_cycle'
import PerformancePlan from '#models/performance_plan'

export function createCycle(
  organization: Organization,
  overrides: Partial<ModelAttributes<PerformanceCycle>> = {}
) {
  return PerformanceCycle.create({
    organizationId: organization.id,
    name: 'Annuel 2026',
    frequency: 'annual',
    periodStart: DateTime.fromISO('2026-01-01'),
    periodEnd: DateTime.fromISO('2026-12-31'),
    ...overrides,
  })
}

export function createPlan(
  organization: Organization,
  overrides: Partial<ModelAttributes<PerformancePlan>> = {}
) {
  return PerformancePlan.create({
    organizationId: organization.id,
    name: 'Plan 2026',
    periodStart: DateTime.fromISO('2026-01-01'),
    periodEnd: DateTime.fromISO('2026-12-31'),
    status: 'active',
    ...overrides,
  })
}

export function createGoal(employee: Employee, overrides: Partial<ModelAttributes<Goal>> = {}) {
  return Goal.create({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    title: 'Réduire les délais de paie',
    ...overrides,
  })
}
