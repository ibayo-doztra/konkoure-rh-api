import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import redis from '@adonisjs/redis/services/main'
import type Organization from '#models/organization'
import { AppException } from '#shared/exceptions/app_exception'
import { withTenant } from '#shared/tenant/with_tenant'
import organizations from '#modules/organizations/repositories/organization_repository'
import entitlementService, { accessError } from '#modules/billing/services/entitlement_service'
import { departmentsIn } from '#modules/hr/repositories/department_repository'
import { jobsIn } from '#modules/recruitment/repositories/job_repository'
import {
  publicJobDto,
  publicJobSummaryDto,
} from '#modules/recruitment/transformers/recruitment_transformer'

/** Cache of the careers page (docs/backend/09 §5). */
const CACHE_TTL_SECONDS = 60

export type CareersPage = {
  organization: { name: string; slug: string; logoUrl: string | null }
  jobs: ReturnType<typeof publicJobSummaryDto>[]
}

const cacheKey = (slug: string) => `careers:${slug}`

/**
 * Public careers pages (docs/backend/06 §11, 05 §4): an active organization
 * whose subscription includes recruitment, and its published offers that are
 * not past their deadline. Anything else is indistinguishable from a missing
 * page (404).
 */
export class CareersService {
  async page(slug: string): Promise<CareersPage> {
    const cached = await this.readCache(slug)
    if (cached) return cached
    const organization = await this.organization(slug)
    const page = await withTenant(organization.id, async (trx) => {
      const jobs = await jobsIn(organization.id, trx).publicList(DateTime.now())
      const names = await this.departmentNames(organization.id, trx)
      return {
        organization: this.organizationDto(organization),
        jobs: jobs.map((job) => publicJobSummaryDto(job, names)),
      }
    })
    await this.writeCache(slug, page)
    return page
  }

  /** Detail of an offer; each read counts as a view. */
  async job(slug: string, jobSlug: string) {
    const organization = await this.organization(slug)
    return withTenant(organization.id, async (trx) => {
      const jobs = jobsIn(organization.id, trx)
      const job = await jobs.publicBySlug(jobSlug, DateTime.now())
      if (!job) throw new AppException('E_NOT_FOUND')
      await jobs.countView(job.id)
      const names = await this.departmentNames(organization.id, trx)
      return { organization: this.organizationDto(organization), job: publicJobDto(job, names) }
    })
  }

  /** Called after each change of an offer: the page is rebuilt on its next read. */
  async forget(organizationId: string) {
    try {
      const organization = await organizations.findActive(organizationId)
      if (organization) await redis.connection('cache').del(cacheKey(organization.slug))
    } catch (error) {
      logger.warn({ err: error }, 'careers.cache_unavailable')
    }
  }

  /** The organization of a public page, or 404 (deleted, no recruitment, no subscription). */
  async organization(slug: string): Promise<Organization> {
    const organization = await organizations.findActiveBySlug(slug)
    if (!organization) throw new AppException('E_NOT_FOUND')
    const entitlements = await entitlementService.resolve(organization.id)
    if (accessError(entitlements, 'recruitment', true)) throw new AppException('E_NOT_FOUND')
    return organization
  }

  private organizationDto(organization: Organization) {
    return { name: organization.name, slug: organization.slug, logoUrl: organization.logoUrl }
  }

  private async departmentNames(
    organizationId: string,
    trx: Parameters<Parameters<typeof withTenant>[1]>[0]
  ) {
    const rows = await departmentsIn(organizationId, trx).all()
    return new Map(rows.map((row) => [row.id, row.name]))
  }

  private async readCache(slug: string): Promise<CareersPage | null> {
    try {
      const raw = await redis.connection('cache').get(cacheKey(slug))
      return raw ? (JSON.parse(raw) as CareersPage) : null
    } catch (error) {
      logger.warn({ err: error }, 'careers.cache_unavailable')
      return null
    }
  }

  private async writeCache(slug: string, page: CareersPage) {
    try {
      await redis
        .connection('cache')
        .set(cacheKey(slug), JSON.stringify(page), 'EX', CACHE_TTL_SECONDS)
    } catch (error) {
      logger.warn({ err: error }, 'careers.cache_unavailable')
    }
  }
}

export default new CareersService()
