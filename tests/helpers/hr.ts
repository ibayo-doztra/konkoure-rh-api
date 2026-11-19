import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import Contract from '#models/contract'
import Department from '#models/department'
import Employee from '#models/employee'
import type Organization from '#models/organization'
import Plan from '#models/plan'
import Skill from '#models/skill'
import Subscription from '#models/subscription'
import type { AppRole } from '#models/user_role'
import entitlementService from '#modules/billing/services/entitlement_service'
import { apiLogin, createOrganization, createUser, grantRoles } from '#tests/helpers/auth'

/** Organization with a running trial, so the `hr` module is open. */
export async function createHrOrganization(name = 'Doztra', maxEmployees?: number) {
  const organization = await createOrganization(name)
  const plan = await Plan.findByOrFail('code', 'free')
  const end = DateTime.now().plus({ days: 20 })
  await Subscription.create({
    organizationId: organization.id,
    planId: plan.id,
    status: 'trialing',
    cycle: 'monthly',
    trialEndsAt: end,
    currentPeriodStart: DateTime.now().minus({ days: 1 }),
    currentPeriodEnd: end,
    maxEmployeesOverride: maxEmployees ?? null,
  })
  await entitlementService.invalidate(organization.id)
  return organization
}

let sequence = 0

export function createEmployee(
  organization: Organization,
  overrides: Partial<ModelAttributes<Employee>> = {}
) {
  sequence += 1
  return Employee.create({
    organizationId: organization.id,
    firstName: 'Aïssatou',
    lastName: `Bah${sequence}`,
    ...overrides,
  })
}

export function createDepartment(organization: Organization, name = `Service ${++sequence}`) {
  return Department.create({ organizationId: organization.id, name })
}

export function createContract(
  employee: Employee,
  overrides: Partial<ModelAttributes<Contract>> = {}
) {
  return Contract.create({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    type: 'cdi',
    startDate: DateTime.fromISO('2026-01-05'),
    ...overrides,
  })
}

export function createSkill(organization: Organization, name = `Compétence ${++sequence}`) {
  return Skill.create({ organizationId: organization.id, name })
}

/** Logged-in member, linked to an employee record unless `linked` is false. */
export async function hrSession(
  client: ApiClient,
  organization: Organization,
  roles: AppRole[],
  options: { linked?: boolean; managerId?: string } = {}
) {
  const user = await createUser({ emailVerifiedAt: DateTime.now() })
  await grantRoles(user, organization, roles)
  const employee =
    options.linked === false
      ? null
      : await createEmployee(organization, {
          userId: user.id,
          managerId: options.managerId ?? null,
        })
  const { accessToken } = await apiLogin(client, user.email)
  return { user, accessToken, employee }
}

export function orgCall(
  client: ApiClient,
  method: string,
  path: string,
  who: { accessToken: string },
  organization: Organization
) {
  // Dynamic method and URL: the request is deliberately outside the typed routes.
  return client
    .request(`/api/v1/org${path}`, method)
    .bearerToken(who.accessToken)
    .header('X-Organization-Id', organization.id)
}
