import { DateTime } from 'luxon'
import type User from '#models/user'
import type Organization from '#models/organization'
import { AppException } from '#shared/exceptions/app_exception'
import { withTenant } from '#shared/tenant/with_tenant'
import { newId } from '#shared/utils/crypto'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import organizations from '#modules/organizations/repositories/organization_repository'
import { slugCandidate, slugify } from '#modules/organizations/slug'
import {
  findPlanByCode,
  subscriptionsIn,
} from '#modules/billing/repositories/subscription_repository'

export interface CreateOrganizationInput {
  name: string
  defaultLanguage?: 'fr' | 'en'
  performanceModel?: 'classic' | 'sap'
}

/** Every new organization starts on this plan, for 30 days (docs/backend/07 §6.2). */
export const TRIAL_PLAN_CODE = 'free'
const TRIAL_DAYS = 30

/** Candidates checked per round before falling back to a random suffix. */
const SLUG_CANDIDATES = 20
const MAX_ATTEMPTS = 3

function isSlugConflict(error: unknown): boolean {
  const pg = error as { code?: string; constraint?: string }
  return pg?.code === '23505' && (pg.constraint ?? '').includes('slug')
}

/** Organization onboarding (docs/backend/04 §3, 06 §3). */
export class OrganizationService {
  /**
   * Creates an organization whose creator becomes `owner`, in one audited
   * transaction, with its trial subscription. The linked employee record is
   * added by the HR module (06 §2: until then `employee` is null).
   */
  async create(user: User, input: CreateOrganizationInput, audit: AuditContext) {
    if (!user.emailVerifiedAt) throw new AppException('E_EMAIL_NOT_VERIFIED')

    const base = slugify(input.name)
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.insert(user, input, base, attempt, audit)
      } catch (error) {
        // Two concurrent creations picked the same free slug: try again.
        if (!isSlugConflict(error) || attempt >= MAX_ATTEMPTS) throw error
      }
    }
  }

  private insert(
    user: User,
    input: CreateOrganizationInput,
    base: string,
    attempt: number,
    audit: AuditContext
  ): Promise<Organization> {
    // The id is chosen first: the owner role is written inside the new tenant (RLS).
    const id = newId()
    return withTenant(id, async (trx) => {
      const slug = await this.freeSlug(base, attempt, trx)
      const organization = await organizations.create(
        {
          id,
          name: input.name,
          slug,
          defaultLanguage: input.defaultLanguage ?? 'fr',
          createdBy: user.id,
          ...(input.performanceModel ? { performanceModel: input.performanceModel } : {}),
        },
        trx
      )
      await organizations.grantRole(
        { userId: user.id, organizationId: organization.id, role: 'owner', grantedBy: user.id },
        trx
      )

      const context = { ...audit, organizationId: organization.id, actorRole: 'owner' }
      await auditService.record(trx, context, {
        action: 'organization.created',
        targetType: 'organization',
        targetId: organization.id,
        after: { name: organization.name, slug: organization.slug },
      })
      await auditService.record(trx, context, {
        action: 'role.granted',
        targetType: 'user',
        targetId: user.id,
        after: { role: 'owner' },
      })

      const plan = await findPlanByCode(TRIAL_PLAN_CODE, trx)
      if (!plan) throw new AppException('E_INTERNAL')
      const startsAt = DateTime.now()
      const subscription = await subscriptionsIn(organization.id, trx).createTrial(
        plan.id,
        startsAt,
        startsAt.plus({ days: TRIAL_DAYS })
      )
      await auditService.record(trx, context, {
        action: 'subscription.changed',
        targetType: 'subscription',
        targetId: subscription.id,
        after: { plan: plan.code, status: subscription.status },
      })

      await organization.refresh()
      return organization
    })
  }

  private async freeSlug(
    base: string,
    attempt: number,
    trx: Parameters<typeof organizations.takenSlugs>[1]
  ): Promise<string> {
    if (attempt > 1) {
      // A concurrent request took the slug between the check and the insert.
      return slugCandidate(base, SLUG_CANDIDATES + Math.floor(Math.random() * 9000) + 1000)
    }
    const candidates = Array.from({ length: SLUG_CANDIDATES }, (_, i) => slugCandidate(base, i + 1))
    const taken = await organizations.takenSlugs(candidates, trx)
    return (
      candidates.find((slug) => !taken.has(slug)) ??
      slugCandidate(base, SLUG_CANDIDATES + Math.floor(Math.random() * 9000) + 1000)
    )
  }
}

export default new OrganizationService()
