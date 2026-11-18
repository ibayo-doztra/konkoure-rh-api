import { beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { SubscriptionSchema } from '#database/schema'
import Plan from '#models/plan'
import { newId } from '#shared/utils/crypto'

export type SubscriptionStatus = SubscriptionSchema['status']
export type BillingCycle = SubscriptionSchema['cycle']

/** Subscription of an organization (docs/backend/02 §9). */
export default class Subscription extends SubscriptionSchema {
  static table = 'subscriptions'
  static selfAssignPrimaryKey = true

  @belongsTo(() => Plan)
  declare plan: BelongsTo<typeof Plan>

  @beforeCreate()
  static assignId(subscription: Subscription) {
    subscription.id ??= newId()
  }
}
