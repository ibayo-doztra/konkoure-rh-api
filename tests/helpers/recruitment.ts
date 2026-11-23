import { DateTime } from 'luxon'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import Job from '#models/job'
import type Organization from '#models/organization'
import Plan from '#models/plan'
import Subscription from '#models/subscription'
import entitlementService from '#modules/billing/services/entitlement_service'
import { createOrganization } from '#tests/helpers/auth'

let sequence = 0

/** Organization on an active `pro` subscription, which includes recruitment. */
export async function createRecruitingOrganization(name = 'Recrute') {
  const organization = await createOrganization(name)
  const plan = await Plan.findByOrFail('code', 'pro')
  await Subscription.create({
    organizationId: organization.id,
    planId: plan.id,
    status: 'active',
    cycle: 'monthly',
    currentPeriodStart: DateTime.now().minus({ days: 1 }),
    currentPeriodEnd: DateTime.now().plus({ days: 29 }),
  })
  await entitlementService.invalidate(organization.id)
  return organization
}

export function createJob(
  organization: Organization,
  overrides: Partial<ModelAttributes<Job>> = {}
) {
  sequence += 1
  return Job.create({
    organizationId: organization.id,
    title: 'Comptable',
    slug: `comptable-${sequence}`,
    contractType: 'cdi',
    description: 'Tenue de la comptabilité générale.',
    requiredDocuments: [],
    ...overrides,
  })
}

/** Published offer, open without deadline. */
export function createPublishedJob(
  organization: Organization,
  overrides: Partial<ModelAttributes<Job>> = {}
) {
  return createJob(organization, {
    status: 'published',
    publishedAt: DateTime.now().minus({ days: 1 }),
    ...overrides,
  })
}
