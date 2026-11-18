import { DateTime, IANAZone } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type User from '#models/user'
import type Organization from '#models/organization'
import { AppException } from '#shared/exceptions/app_exception'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { newId } from '#shared/utils/crypto'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import organizations from '#modules/organizations/repositories/organization_repository'
import { slugCandidate, slugify } from '#modules/organizations/slug'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import {
  findPlanByCode,
  subscriptionsIn,
} from '#modules/billing/repositories/subscription_repository'

export interface CreateOrganizationInput {
  name: string
  defaultLanguage?: 'fr' | 'en'
  performanceModel?: 'classic' | 'sap'
}

export interface UpdateOrganizationInput {
  name?: string
  defaultLanguage?: 'fr' | 'en'
  defaultCurrency?: 'GNF'
  timezone?: string
  performanceModel?: 'classic' | 'sap'
}

const UPDATABLE_FIELDS = [
  'name',
  'defaultLanguage',
  'defaultCurrency',
  'timezone',
  'performanceModel',
] as const

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
   * Creates an organization whose creator becomes `owner`, with their linked
   * employee record (04 §3) and the trial subscription, in one audited transaction.
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

  async current(tenant: TenantContext): Promise<Organization> {
    const organization = await organizations.findActive(tenant.organizationId)
    if (!organization) throw new AppException('E_NOT_FOUND')
    return organization
  }

  /** PATCH /org. The slug never changes: public careers links depend on it. */
  async update(
    tenant: TenantContext,
    actor: User,
    input: UpdateOrganizationInput,
    audit: AuditContext
  ): Promise<Organization> {
    if (input.timezone !== undefined && !IANAZone.isValidZone(input.timezone)) {
      throw AppException.validation('timezone', 'timezone', 'validation.organization.timezone')
    }

    return withTenant(tenant.organizationId, async (trx) => {
      const organization = await this.lock(tenant, trx)
      const before: Record<string, unknown> = {}
      const after: Record<string, unknown> = {}
      for (const field of UPDATABLE_FIELDS) {
        const value = input[field]
        if (value === undefined || value === organization[field]) continue
        before[field] = organization[field]
        after[field] = value
      }
      if (Object.keys(after).length === 0) return organization

      organization.merge({ ...after, updatedBy: actor.id })
      await organizations.save(organization, trx)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'organization.updated',
        targetType: 'organization',
        targetId: organization.id,
        before,
        after,
      })
      await organization.refresh()
      return organization
    })
  }

  /** PUT /org/settings: replaces the whole block (02 §11). */
  updateSettings(
    tenant: TenantContext,
    actor: User,
    settings: Record<string, unknown>,
    audit: AuditContext
  ): Promise<Organization> {
    return withTenant(tenant.organizationId, async (trx) => {
      const organization = await this.lock(tenant, trx)
      const before = organization.settings
      organization.merge({ settings, updatedBy: actor.id })
      await organizations.save(organization, trx)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'organization.settings_updated',
        targetType: 'organization',
        targetId: organization.id,
        before: { settings: before },
        after: { settings },
      })
      await organization.refresh()
      return organization
    })
  }

  /**
   * Soft delete confirmed by the exact name: access stops at once. The physical
   * purge after 30 days (06 §3) is a later maintenance job.
   */
  async remove(tenant: TenantContext, actor: User, confirmName: string, audit: AuditContext) {
    await withTenant(tenant.organizationId, async (trx) => {
      const organization = await this.lock(tenant, trx)
      if (organization.name !== confirmName) {
        throw AppException.validation(
          'confirmName',
          'mismatch',
          'validation.organization.confirmName'
        )
      }
      organization.merge({ deletedAt: DateTime.now(), updatedBy: actor.id })
      await organizations.save(organization, trx)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'organization.deleted',
        targetType: 'organization',
        targetId: organization.id,
        before: { name: organization.name, slug: organization.slug },
      })
    })
  }

  private async lock(tenant: TenantContext, trx: TransactionClientContract) {
    const organization = await organizations.findActiveForUpdate(tenant.organizationId, trx)
    if (!organization) throw new AppException('E_NOT_FOUND')
    return organization
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
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

      const [firstName, ...lastNames] = (user.fullName ?? user.email.split('@')[0])
        .trim()
        .split(/\s+/)
      const employee = await employeesIn(organization.id, trx).create({
        userId: user.id,
        firstName,
        lastName: lastNames.join(' '),
        email: user.email,
        createdBy: user.id,
        updatedBy: user.id,
      })

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
      await auditService.record(trx, context, {
        action: 'employee.created',
        targetType: 'employee',
        targetId: employee.id,
        after: { status: 'active', departmentId: null },
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
