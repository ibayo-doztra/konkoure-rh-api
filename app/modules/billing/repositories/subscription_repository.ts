import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Plan from '#models/plan'
import Subscription from '#models/subscription'
import { TenantRepository } from '#shared/base/tenant_repository'

/** Subscriptions of one organization (docs/backend/02 §9). */
export class SubscriptionRepository extends TenantRepository<typeof Subscription> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Subscription, organizationId, trx)
  }

  /** The most recent subscription carries the current state of the organization. */
  current() {
    return this.query().preload('plan').orderBy('created_at', 'desc').orderBy('id', 'desc').first()
  }

  /** The current subscription, locked, with its plan and scheduled plan. */
  currentForUpdate() {
    return this.query()
      .preload('plan')
      .preload('scheduledPlan')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .forUpdate()
      .first()
  }

  /** Ends the current subscription: only one non-expired row per organization (index). */
  async expireCurrent() {
    await Subscription.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .whereNot('status', 'expired')
      .update({ status: 'expired' })
  }

  /** Active paid-like period on a plan, granted outside Djomy (`subscription:grant`). */
  createGranted(planId: string, startsAt: DateTime, endsAt: DateTime) {
    return Subscription.create(
      {
        organizationId: this.organizationId,
        planId,
        status: 'active',
        cycle: 'monthly',
        currentPeriodStart: startsAt,
        currentPeriodEnd: endsAt,
      },
      { client: this.trx }
    )
  }

  createTrial(planId: string, startsAt: DateTime, endsAt: DateTime) {
    return Subscription.create(
      {
        organizationId: this.organizationId,
        planId,
        status: 'trialing',
        cycle: 'monthly',
        trialEndsAt: endsAt,
        currentPeriodStart: startsAt,
        currentPeriodEnd: endsAt,
      },
      { client: this.trx }
    )
  }
}

export function subscriptionsIn(organizationId: string, trx: TransactionClientContract) {
  return new SubscriptionRepository(organizationId, trx)
}

/** Public catalogue of live plans, in display order (06 §10). */
export function publicPlans() {
  return Plan.query()
    .whereNull('deleted_at')
    .where('is_public', true)
    .orderBy('sort_order', 'asc')
    .orderBy('code', 'asc')
}

/** The catalogue is global: plans are not tenant data. */
export function findPlanByCode(code: string, trx: TransactionClientContract) {
  return Plan.query({ client: trx }).where('code', code).whereNull('deleted_at').first()
}
