import logger from '@adonisjs/core/services/logger'
import encryption from '@adonisjs/core/services/encryption'
import redis from '@adonisjs/redis/services/main'
import type User from '#models/user'
import type SocialAccount from '#models/social_account'
import env from '#start/env'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { randomToken } from '#shared/utils/crypto'
import organizations from '#modules/organizations/repositories/organization_repository'
import { membersIn } from '#modules/organizations/repositories/member_repository'
import { socialAccountsIn } from '#modules/integrations/repositories/social_repository'
import {
  SocialProviderError,
  socialProviders,
  type ConnectedAccount,
  type WiredProvider,
} from '#modules/integrations/providers/social_providers'

/** A connection must come back within 10 minutes, once (decision of 2026-11-26). */
const STATE_TTL_SECONDS = 10 * 60
export const TOKEN_PURPOSE = 'social-token'

interface PendingConnection {
  organizationId: string
  userId: string
  provider: WiredProvider
}

/** Outcome sent back to the front in the redirect (`?connected=` or `?error=`). */
export type CallbackError =
  'invalid_state' | 'denied' | 'forbidden' | 'no_pages' | 'provider_error' | 'unavailable'

export const encryptToken = (token: string) => encryption.encrypt(token, undefined, TOKEN_PURPOSE)
export const decryptToken = (value: string) => encryption.decrypt<string>(value, TOKEN_PURPOSE)

const stateKey = (state: string) => `social:oauth:${state}`

/** Where the provider sends the member back (to declare in each provider's app). */
export function callbackUrl(provider: WiredProvider) {
  return `${env.get('APP_URL').replace(/\/$/, '')}/api/v1/oauth/social/${provider}/callback`
}

function frontUrl(outcome: { connected: WiredProvider; count: number } | { error: CallbackError }) {
  const query =
    'error' in outcome
      ? new URLSearchParams({ error: outcome.error })
      : new URLSearchParams({ connected: outcome.connected, count: String(outcome.count) })
  return `${env.get('WEB_APP_URL').replace(/\/$/, '')}/app/settings/integrations?${query}`
}

/**
 * Social accounts of the organization (06 §8, 08 §8, decisions of 2026-11-26):
 * an OAuth flow started by O H and ended by the provider's callback, one
 * account per LinkedIn company page or Facebook page. Tokens are encrypted
 * and never returned.
 */
export class SocialAccountService {
  list(tenant: TenantContext) {
    return withTenant(tenant.organizationId, (trx) =>
      socialAccountsIn(tenant.organizationId, trx).all()
    )
  }

  /** `POST /org/integrations/social/accounts`: the provider's consent URL. */
  async start(tenant: TenantContext, actor: User, provider: WiredProvider) {
    const client = socialProviders[provider]
    if (!client.configured) throw new AppException('E_DEPENDENCY_UNAVAILABLE')
    const state = randomToken(32)
    const pending: PendingConnection = {
      organizationId: tenant.organizationId,
      userId: actor.id,
      provider,
    }
    await redis
      .connection('cache')
      .set(stateKey(state), JSON.stringify(pending), 'EX', STATE_TTL_SECONDS)
    return { authorizationUrl: client.authorizationUrl(state, callbackUrl(provider)) }
  }

  /**
   * `GET /api/v1/oauth/social/:provider/callback` (public): consumes the state,
   * exchanges the code, then records the pages if the member who started the
   * flow is still owner or hr_admin. Always answers with a front-end URL.
   */
  async callback(
    provider: WiredProvider,
    query: { code?: string; state?: string; error?: string },
    audit: AuditContext
  ): Promise<string> {
    const pending = query.state ? await this.consume(query.state) : null
    if (!pending || pending.provider !== provider) return frontUrl({ error: 'invalid_state' })
    if (query.error || !query.code) return frontUrl({ error: 'denied' })

    const client = socialProviders[provider]
    if (!client.configured) return frontUrl({ error: 'unavailable' })
    let accounts: ConnectedAccount[]
    try {
      accounts = await client.connect(query.code, callbackUrl(provider))
    } catch (error) {
      logger.warn({ err: error, provider }, 'social.connect_failed')
      return frontUrl({
        error: error instanceof SocialProviderError ? 'provider_error' : 'unavailable',
      })
    }
    if (accounts.length === 0) return frontUrl({ error: 'no_pages' })

    const { organizationId, userId } = pending
    const saved = await withTenant(organizationId, async (trx) => {
      const organization = await organizations.findActive(organizationId, trx)
      const member = organization ? await membersIn(organizationId, trx).findMember(userId) : null
      if (!member?.roles.some((role) => role === 'owner' || role === 'hr_admin')) return null
      const repository = socialAccountsIn(organizationId, trx)
      const context = {
        ...audit,
        organizationId,
        actorUserId: userId,
        actorRole: member.roles.includes('owner') ? 'owner' : 'hr_admin',
      }
      for (const connected of accounts) {
        const attributes = {
          accountName: connected.accountName,
          accessTokenEncrypted: encryptToken(connected.accessToken),
          refreshTokenEncrypted: connected.refreshToken
            ? encryptToken(connected.refreshToken)
            : null,
          tokenExpiresAt: connected.expiresAt,
          scopes: connected.scopes,
          status: 'active' as const,
          connectedBy: userId,
          metadata: connected.metadata,
        }
        const existing = await repository.findByExternal(provider, connected.accountId)
        let account: SocialAccount
        if (existing) {
          existing.merge(attributes)
          account = await repository.save(existing)
        } else {
          account = await repository.create({
            ...attributes,
            provider,
            accountId: connected.accountId,
          })
        }
        await auditService.record(trx, context, {
          action: 'social_account.connected',
          targetType: 'social_account',
          targetId: account.id,
          after: { provider, accountId: connected.accountId, accountName: connected.accountName },
        })
      }
      return accounts.length
    })
    if (saved === null) return frontUrl({ error: 'forbidden' })
    return frontUrl({ connected: provider, count: saved })
  }

  /** `DELETE /org/integrations/social/accounts/:id`: past publications keep their provider. */
  async remove(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const accounts = socialAccountsIn(organizationId, trx)
      const account = await accounts.findOrFail(id)
      await accounts.remove(account)
      await auditService.record(
        trx,
        { ...audit, organizationId, actorUserId: actor.id, actorRole: tenant.primaryRole },
        {
          action: 'social_account.disconnected',
          targetType: 'social_account',
          targetId: id,
          before: { provider: account.provider, accountName: account.accountName },
        }
      )
    })
  }

  /** Single use: a replayed or forged state finds nothing. */
  private async consume(state: string): Promise<PendingConnection | null> {
    const raw = await redis.connection('cache').getdel(stateKey(state))
    if (!raw) return null
    try {
      return JSON.parse(raw) as PendingConnection
    } catch {
      return null
    }
  }
}

export default new SocialAccountService()
