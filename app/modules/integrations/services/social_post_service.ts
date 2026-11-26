import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import type User from '#models/user'
import type SocialPost from '#models/social_post'
import type SocialAccount from '#models/social_account'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import queueService from '#shared/queue/queue_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import organizations from '#modules/organizations/repositories/organization_repository'
import { membersIn } from '#modules/organizations/repositories/member_repository'
import entitlementService, { accessError } from '#modules/billing/services/entitlement_service'
import notificationService from '#modules/notifications/services/notification_service'
import { jobsIn } from '#modules/recruitment/repositories/job_repository'
import { careersJobUrl } from '#modules/recruitment/careers_urls'
import aiService from '#modules/integrations/services/ai_service'
import { socialPostTask } from '#modules/integrations/prompts/social_post'
import {
  socialAccountsIn,
  socialPostsIn,
} from '#modules/integrations/repositories/social_repository'
import { decryptToken, encryptToken } from '#modules/integrations/services/social_account_service'
import {
  SocialProviderError,
  socialProviders,
  type WiredProvider,
} from '#modules/integrations/providers/social_providers'

/** LinkedIn tokens are renewed when they expire within this window (08 §8). */
const REFRESH_WITHIN_DAYS = 7
/** Publications listed for an offer (a handful per network in practice). */
const LIST_LIMIT = 100

export interface PublishJob {
  organizationId: string
  postId: string
}

const isWired = (provider: string): provider is WiredProvider => provider in socialProviders

/**
 * Publication of job offers on the organization's social accounts (06 §8,
 * 08 §8, decisions of 2026-11-26): the text comes from the client, the link to
 * the public careers page is added; one post per account, sent by the
 * `outbound` queue after the commit.
 */
export class SocialPostService {
  /** `POST /org/recruitment/jobs/:id/social-posts` → `202` with the pending posts. */
  async create(
    tenant: TenantContext,
    actor: User,
    jobId: string,
    input: { accountIds: string[]; content: string },
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    await this.requireIntegrations(organizationId)
    const posts = await withTenant(organizationId, async (trx) => {
      const job = await jobsIn(organizationId, trx).findOrFail(jobId)
      if (job.status !== 'published') {
        throw new AppException('E_CONFLICT', {
          details: [
            { field: 'status', rule: 'notPublished', message: 'validation.social.notPublished' },
          ],
        })
      }
      const ids = [...new Set(input.accountIds)]
      const accounts = await socialAccountsIn(organizationId, trx).activeAmong(ids)
      if (accounts.length !== ids.length) {
        throw AppException.validation('accountIds', 'exists', 'validation.social.account')
      }
      for (const account of accounts) {
        if (!isWired(account.provider) || !socialProviders[account.provider].configured) {
          throw new AppException('E_DEPENDENCY_UNAVAILABLE')
        }
      }
      const repository = socialPostsIn(organizationId, trx)
      const created: Array<{ post: SocialPost; accountName: string | null }> = []
      for (const account of accounts) {
        const post = await repository.create({
          jobId,
          socialAccountId: account.id,
          provider: account.provider,
          content: input.content,
          mediaUrls: [],
          status: 'pending',
          createdBy: actor.id,
        })
        created.push({ post, accountName: account.accountName })
      }
      await auditService.record(
        trx,
        { ...audit, organizationId, actorUserId: actor.id, actorRole: tenant.primaryRole },
        {
          action: 'social_post.requested',
          targetType: 'job',
          targetId: jobId,
          after: { accounts: accounts.map((account) => account.id) },
        }
      )
      return created
    })
    for (const { post } of posts) {
      await queueService.dispatch('social.publish', { organizationId, postId: post.id })
    }
    return posts
  }

  /** `GET /org/recruitment/jobs/:id/social-posts`: their state, newest first (2026-11-26). */
  async list(tenant: TenantContext, jobId: string) {
    const { organizationId } = tenant
    await this.requireIntegrations(organizationId, true)
    return withTenant(organizationId, async (trx) => {
      await jobsIn(organizationId, trx).findOrFail(jobId)
      const posts = await socialPostsIn(organizationId, trx).forJob(jobId, LIST_LIMIT)
      const accountIds = [
        ...new Set(posts.map((post) => post.socialAccountId).filter((id) => id !== null)),
      ]
      const accounts = await socialAccountsIn(organizationId, trx).among(accountIds)
      const names = new Map(accounts.map((account) => [account.id, account.accountName]))
      return posts.map((post) => ({
        post,
        accountName: post.socialAccountId ? (names.get(post.socialAccountId) ?? null) : null,
      }))
    })
  }

  /**
   * `social.publish` job: sends one pending post. A provider refusal is final
   * (status `failed` with its message); an expired token also marks the
   * account `expired` and notifies the administrators. Safe to retry: a post
   * that is no longer pending is left alone.
   */
  async publish(payload: PublishJob) {
    const { organizationId, postId } = payload
    const prepared = await withTenant(organizationId, async (trx) => {
      const post = await socialPostsIn(organizationId, trx).findForUpdate(postId)
      if (!post || post.status !== 'pending') return null
      const account = post.socialAccountId
        ? await socialAccountsIn(organizationId, trx).find(post.socialAccountId)
        : null
      const job = await jobsIn(organizationId, trx).find(post.jobId)
      const organization = await organizations.findActive(organizationId, trx)
      return { post, account, job, organization }
    })
    if (!prepared) return 'skipped'
    const { post, account, job, organization } = prepared
    if (
      !account ||
      account.status !== 'active' ||
      !isWired(account.provider) ||
      !job ||
      !organization
    ) {
      await this.finish(organizationId, postId, { error: 'account_unavailable' })
      return 'failed'
    }

    try {
      const result = await socialProviders[account.provider].publish({
        accountId: account.accountId,
        accessToken: decryptToken(account.accessTokenEncrypted) ?? '',
        content: post.content,
        link: careersJobUrl(organization.slug, job.slug),
        title: job.title,
      })
      await this.finish(organizationId, postId, { result })
      return 'published'
    } catch (error) {
      if (!(error instanceof SocialProviderError)) throw error
      await this.finish(organizationId, postId, { error: error.message })
      if (error.expired) await this.expire(organizationId, account)
      return 'failed'
    }
  }

  /** `POST /org/recruitment/jobs/:id/social-posts/suggest`: AI text, one credit, not saved. */
  async suggest(
    tenant: TenantContext,
    actor: User,
    jobId: string,
    input: { provider: WiredProvider; language?: 'fr' | 'en' }
  ) {
    const { organizationId } = tenant
    await this.requireIntegrations(organizationId)
    const facts = await withTenant(organizationId, async (trx) => {
      const job = await jobsIn(organizationId, trx).findOrFail(jobId)
      const organization = await organizations.findActive(organizationId, trx)
      return {
        language: input.language ?? (organization?.defaultLanguage === 'en' ? 'en' : 'fr'),
        provider: input.provider,
        organization: organization?.name ?? '',
        title: job.title,
        contractType: job.contractType,
        location: job.location,
        description: job.description ?? '',
      } as const
    })
    return aiService.run(socialPostTask(facts), {
      organizationId,
      userId: actor.id,
      module: 'recruitment',
      path: `/org/recruitment/jobs/${jobId}/social-posts/suggest`,
    })
  }

  /**
   * `social.refresh-tokens` (daily, 08 §8): renews the tokens expiring within
   * 7 days; on failure the account turns `expired` and the administrators are
   * notified. One failing organization does not stop the others.
   */
  async refreshTokens(at: DateTime = DateTime.now()) {
    const limit = at.plus({ days: REFRESH_WITHIN_DAYS })
    let refreshed = 0
    let expired = 0
    for (const organizationId of await organizations.activeIds()) {
      const due = await withTenant(organizationId, (trx) =>
        socialAccountsIn(organizationId, trx).expiringBefore(limit)
      )
      for (const account of due) {
        if (!isWired(account.provider)) continue
        try {
          const token = await socialProviders[account.provider].refresh(
            account.refreshTokenEncrypted ? decryptToken(account.refreshTokenEncrypted) : null
          )
          if (!token) continue
          await withTenant(organizationId, async (trx) => {
            const accounts = socialAccountsIn(organizationId, trx)
            const locked = await accounts.findForUpdate(account.id)
            if (!locked) return
            locked.merge({
              accessTokenEncrypted: encryptToken(token.accessToken),
              refreshTokenEncrypted: token.refreshToken ? encryptToken(token.refreshToken) : null,
              tokenExpiresAt: token.expiresAt,
            })
            await accounts.save(locked)
          })
          refreshed++
        } catch (error) {
          logger.warn({ err: error, accountId: account.id }, 'social.refresh_failed')
          if (error instanceof SocialProviderError && error.expired) {
            await this.expire(organizationId, account)
            expired++
          }
        }
      }
    }
    logger.info({ refreshed, expired }, 'social.refresh_done')
    return refreshed
  }

  private async finish(
    organizationId: string,
    postId: string,
    outcome: { result: { externalPostId: string; externalUrl: string | null } } | { error: string }
  ) {
    await withTenant(organizationId, async (trx) => {
      const posts = socialPostsIn(organizationId, trx)
      const post = await posts.findForUpdate(postId)
      if (!post || post.status !== 'pending') return
      if ('result' in outcome) {
        post.merge({
          status: 'published',
          externalPostId: outcome.result.externalPostId,
          externalUrl: outcome.result.externalUrl,
          publishedAt: DateTime.now(),
          errorMessage: null,
        })
      } else {
        post.merge({ status: 'failed', errorMessage: outcome.error })
      }
      await posts.save(post)
    })
  }

  /** The account must be reconnected; owners and hr_admins are told (08 §8). */
  private async expire(organizationId: string, account: SocialAccount) {
    const recipients = await withTenant(organizationId, async (trx) => {
      const accounts = socialAccountsIn(organizationId, trx)
      const locked = await accounts.findForUpdate(account.id)
      if (!locked || locked.status !== 'active') return []
      locked.status = 'expired'
      await accounts.save(locked)
      const members = membersIn(organizationId, trx)
      return [
        ...(await members.accountsWithRole('owner')),
        ...(await members.accountsWithRole('hr_admin')),
      ]
    })
    if (recipients.length === 0) return
    await notificationService.notify(
      organizationId,
      recipients,
      {
        type: 'social_account.expired',
        key: 'socialAccountExpired',
        data: { provider: account.provider, accountName: account.accountName },
        link: '/app/settings/integrations',
        payload: { socialAccountId: account.id },
      },
      null
    )
  }

  private async requireIntegrations(organizationId: string, readOnly = false) {
    const entitlements = await entitlementService.resolve(organizationId)
    const refused = accessError(entitlements, 'integrations', readOnly)
    if (refused) throw refused
  }
}

export default new SocialPostService()
