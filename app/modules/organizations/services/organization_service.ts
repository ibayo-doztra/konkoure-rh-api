import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import type Organization from '#models/organization'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import organizations from '#modules/organizations/repositories/organization_repository'
import { slugCandidate, slugify } from '#modules/organizations/slug'

export interface CreateOrganizationInput {
  name: string
  defaultLanguage?: 'fr' | 'en'
  performanceModel?: 'classic' | 'sap'
}

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
   * transaction. The linked employee record and the trial subscription are
   * added by the HR and billing modules (06 §2: until then `employee` and
   * `subscription` are null).
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
    return db.transaction(async (trx) => {
      const slug = await this.freeSlug(base, attempt, trx)
      const organization = await organizations.create(
        {
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
