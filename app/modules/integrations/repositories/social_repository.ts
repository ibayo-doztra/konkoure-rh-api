import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { DateTime } from 'luxon'
import SocialAccount, { type SocialProvider } from '#models/social_account'
import SocialPost from '#models/social_post'
import { TenantRepository } from '#shared/base/tenant_repository'

/** Social accounts of the organization (08 §8). */
export class SocialAccountRepository extends TenantRepository<typeof SocialAccount> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(SocialAccount, organizationId, trx)
  }

  all() {
    return this.query().orderBy('provider').orderBy('account_name').orderBy('id')
  }

  findByExternal(provider: SocialProvider, accountId: string) {
    return this.query()
      .where('provider', provider)
      .where('account_id', accountId)
      .forUpdate()
      .first()
  }

  /** Accounts among `ids`, whatever their status. */
  among(ids: string[]) {
    return this.query().whereIn('id', ids)
  }

  /** Active accounts among `ids`; ids of another organization are simply absent. */
  activeAmong(ids: string[]) {
    return this.query().whereIn('id', ids).where('status', 'active')
  }

  /** Active accounts whose token expires before `limit` (refresh job). */
  expiringBefore(limit: DateTime) {
    return this.query()
      .where('status', 'active')
      .whereNotNull('token_expires_at')
      .where('token_expires_at', '<', limit.toJSDate())
  }

  create(data: Partial<SocialAccount>) {
    return SocialAccount.create(
      { ...data, organizationId: this.organizationId },
      { client: this.trx }
    )
  }

  async remove(account: SocialAccount) {
    account.useTransaction(this.trx)
    await account.delete()
  }
}

/** Publications of the organization's job offers (08 §8). */
export class SocialPostRepository extends TenantRepository<typeof SocialPost> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(SocialPost, organizationId, trx)
  }

  create(data: Partial<SocialPost>) {
    return SocialPost.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  /** Publications of an offer, newest first. */
  forJob(jobId: string, limit: number) {
    return this.query()
      .where('job_id', jobId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
  }
}

export const socialAccountsIn = (organizationId: string, trx: TransactionClientContract) =>
  new SocialAccountRepository(organizationId, trx)

export const socialPostsIn = (organizationId: string, trx: TransactionClientContract) =>
  new SocialPostRepository(organizationId, trx)
