import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import limiter from '@adonisjs/limiter/services/main'
import type User from '#models/user'
import type Invitation from '#models/invitation'
import type { AppRole } from '#models/user_role'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { dispatchMail } from '#shared/mail/dispatch_mail'
import { randomToken, sha256 } from '#shared/utils/crypto'
import {
  invitationsIn,
  organizationIdForInvitationToken,
  type InvitationListFilters,
} from '#modules/invitations/repositories/invitation_repository'
import organizations from '#modules/organizations/repositories/organization_repository'
import users from '#modules/users/repositories/user_repository'
import authService from '#modules/auth/services/auth_service'
import tokenService, {
  type ClientInfo,
  type IssuedTokens,
} from '#modules/auth/services/token_service'
import { assertStrongPassword } from '#modules/auth/services/password_policy'
import { authSettings } from '#modules/auth/auth_settings'
import { InvitationMail } from '#modules/invitations/mails/invitation_mail'

/** Invitation lifetime and resend quota (docs/backend/04 §3, 06 §3). */
const TTL_DAYS = 7
const RESENDS_PER_DAY = 3

export interface InvitationPreview {
  organizationName: string
  email: string
  role: AppRole
  expiresAt: DateTime
  accountExists: boolean
}

const notFound = () => new AppException('E_NOT_FOUND')

/** Invitations to an organization and their public acceptance (04 §3). */
export class InvitationService {
  list(tenant: TenantContext, filters: InvitationListFilters) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => invitationsIn(organizationId, trx).paginate(filters))
  }

  /** Invites an e-mail with a role; the e-mail leaves after the commit. */
  async create(
    tenant: TenantContext,
    inviter: User,
    input: { email: string; role: AppRole },
    audit: AuditContext
  ): Promise<Invitation> {
    const token = randomToken(32)
    const invitation = await withTenant(tenant.organizationId, async (trx) => {
      const invitations = invitationsIn(tenant.organizationId, trx)
      if (await invitations.isMember(input.email)) {
        throw new AppException('E_CONFLICT', {
          details: [
            {
              field: 'email',
              rule: 'alreadyMember',
              message: 'validation.invitation.alreadyMember',
            },
          ],
        })
      }

      const pending = await invitations.findPendingByEmail(input.email)
      if (pending?.isUsable) {
        throw new AppException('E_CONFLICT', {
          details: [{ field: 'email', rule: 'pending', message: 'validation.invitation.pending' }],
        })
      }
      if (pending) {
        // Past its date: frees the (organization, e-mail) pending slot.
        pending.status = 'expired'
        await invitations.save(pending)
      }

      const created = await invitations.create({
        email: input.email,
        role: input.role,
        tokenHash: sha256(token),
        expiresAt: DateTime.now().plus({ days: TTL_DAYS }),
        invitedBy: inviter.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'invitation.sent',
        targetType: 'invitation',
        targetId: created.id,
        after: { email: created.email, role: created.role },
      })
      await created.refresh()
      return created
    })

    await this.sendMail(invitation, inviter, token)
    return invitation
  }

  /** New link and expiry, at most 3 sends per 24 h; older links stop working. */
  async resend(
    tenant: TenantContext,
    inviter: User,
    id: string,
    audit: AuditContext
  ): Promise<Invitation> {
    const current = await withTenant(tenant.organizationId, (trx) =>
      invitationsIn(tenant.organizationId, trx).findOrFail(id)
    )
    if (current.status !== 'pending') throw this.notPending()
    await limiter
      .use({ requests: RESENDS_PER_DAY, duration: '24 hours' })
      .consume(`invitation-resend:${current.id}`)

    const token = randomToken(32)
    const invitation = await withTenant(tenant.organizationId, async (trx) => {
      const invitations = invitationsIn(tenant.organizationId, trx)
      const locked = await invitations.findForUpdate(id)
      if (!locked) throw notFound()
      if (locked.status !== 'pending') throw this.notPending()

      locked.tokenHash = sha256(token)
      locked.expiresAt = DateTime.now().plus({ days: TTL_DAYS })
      locked.sendCount += 1
      locked.lastSentAt = DateTime.now()
      await invitations.save(locked)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'invitation.resent',
        targetType: 'invitation',
        targetId: locked.id,
        after: { email: locked.email, sendCount: locked.sendCount },
      })
      return locked
    })

    await this.sendMail(invitation, inviter, token)
    return invitation
  }

  async revoke(tenant: TenantContext, id: string, audit: AuditContext) {
    await withTenant(tenant.organizationId, async (trx) => {
      const invitations = invitationsIn(tenant.organizationId, trx)
      const invitation = await invitations.findForUpdate(id)
      if (!invitation) throw notFound()
      if (invitation.status !== 'pending') throw this.notPending()

      invitation.status = 'revoked'
      await invitations.save(invitation)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'invitation.revoked',
        targetType: 'invitation',
        targetId: invitation.id,
        before: { status: 'pending' },
        after: { status: 'revoked' },
      })
    })
  }

  /** Public preview of a usable invitation; anything else is 404. */
  async preview(token: string): Promise<InvitationPreview> {
    const { invitation, organization } = await this.findByToken(sha256(token))

    return {
      organizationName: organization.name,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      accountExists: (await users.findByEmail(invitation.email)) !== null,
    }
  }

  /**
   * Accepts an invitation (04 §3). An existing account proves itself with its
   * password (same checks and lockout as /auth/login) and just gains the role;
   * otherwise the account is created, its e-mail verified by the link itself.
   */
  async accept(
    token: string,
    input: { password: string; fullName?: string },
    client: ClientInfo,
    audit: AuditContext
  ): Promise<{ user: User; tokens: IssuedTokens }> {
    const tokenHash = sha256(token)
    const { invitation, organizationId } = await this.findByToken(tokenHash)

    const existing = await users.findByEmail(invitation.email)
    let session: { user: User; tokens: IssuedTokens } | null = null
    let passwordHash: string | null = null
    if (existing) {
      session = await authService.login(invitation.email, input.password, client, audit)
    } else {
      assertStrongPassword(input.password, {
        email: invitation.email,
        fullName: input.fullName ?? null,
      })
      passwordHash = await hash.make(input.password)
    }

    const user = await withTenant(organizationId, async (trx) => {
      const invitations = invitationsIn(organizationId, trx)
      const locked = await invitations.findByTokenHash(tokenHash, { lock: true })
      if (!locked?.isUsable) throw notFound()

      let member: User
      if (session) {
        member = session.user
        if (!member.emailVerifiedAt) {
          member.emailVerifiedAt = DateTime.now()
          await users.save(member, trx)
        }
      } else {
        member = await users.create(
          {
            email: locked.email,
            passwordHash,
            fullName: input.fullName ?? null,
            preferredLanguage: 'fr',
            emailVerifiedAt: DateTime.now(),
          },
          trx
        )
      }

      const granted = await invitations.grantRole({
        userId: member.id,
        role: locked.role,
        grantedBy: locked.invitedBy,
      })
      locked.status = 'accepted'
      locked.acceptedAt = DateTime.now()
      locked.acceptedUserId = member.id
      await invitations.save(locked)

      const context: AuditContext = {
        ...audit,
        organizationId: locked.organizationId,
        actorUserId: member.id,
        actorEmail: member.email,
      }
      await auditService.record(trx, context, {
        action: 'invitation.accepted',
        targetType: 'invitation',
        targetId: locked.id,
        after: { role: locked.role, accountCreated: !session },
      })
      if (granted) {
        await auditService.record(trx, context, {
          action: 'role.granted',
          targetType: 'user',
          targetId: member.id,
          after: { role: locked.role },
        })
      }
      return member
    })

    if (session) return session
    await user.refresh()
    return { user, tokens: await tokenService.issue(user, client) }
  }

  /**
   * Usable invitation behind a token; unknown, used or expired tokens are 404,
   * like those of a deleted organization.
   */
  private async findByToken(tokenHash: string) {
    const organizationId = await organizationIdForInvitationToken(tokenHash)
    if (!organizationId) throw notFound()
    const invitation = await withTenant(organizationId, (trx) =>
      invitationsIn(organizationId, trx).findByTokenHash(tokenHash)
    )
    if (!invitation?.isUsable) throw notFound()
    const organization = await organizations.findActive(organizationId)
    if (!organization) throw notFound()
    return { invitation, organizationId, organization }
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }

  private notPending() {
    return new AppException('E_CONFLICT', {
      details: [
        { field: 'status', rule: 'notPending', message: 'validation.invitation.notPending' },
      ],
    })
  }

  private async sendMail(invitation: Invitation, inviter: User, token: string) {
    const organization = await organizations.findActive(invitation.organizationId)
    if (!organization) return
    const url = `${authSettings.webAppUrl}/invitation?token=${encodeURIComponent(token)}`
    await dispatchMail(
      new InvitationMail(
        {
          email: invitation.email,
          fullName: null,
          preferredLanguage: organization.defaultLanguage,
        },
        {
          organization: organization.name,
          inviter: inviter.fullName ?? inviter.email,
          role: invitation.role,
          url,
        }
      )
    )
  }
}

export default new InvitationService()
