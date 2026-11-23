import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import QRCode from 'qrcode'
import type User from '#models/user'
import type Job from '#models/job'
import type { JobStatus, RequiredDocument } from '#models/job'
import type { ContractType } from '#models/contract'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import organizations from '#modules/organizations/repositories/organization_repository'
import { slugCandidate, slugify } from '#modules/organizations/slug'
import { departmentsIn } from '#modules/hr/repositories/department_repository'
import { employeesIn } from '#modules/hr/repositories/employee_repository'
import { jobsIn, type JobRepository } from '#modules/recruitment/repositories/job_repository'
import careersService from '#modules/recruitment/services/careers_service'
import { careersJobUrl } from '#modules/recruitment/careers_urls'

export interface JobInput {
  title?: string
  departmentId?: string | null
  location?: string | null
  contractType?: ContractType
  description?: string | null
  requirements?: string | null
  deadline?: DateTime | null
  requiredDocuments?: RequiredDocument[]
}

export interface JobListQuery {
  page?: number
  perPage?: number
  q?: string
  filter?: { status?: JobStatus; departmentId?: string }
}

/** Slug attempts before giving up (`title`, `title-2`, …). */
const SLUG_ATTEMPTS = 50

/** `jobs:auto-close`: offers expired for 7 days are closed (07 §4.2). */
const AUTO_CLOSE_AFTER_DAYS = 7

const conflict = (rule: string, message: string) =>
  new AppException('E_CONFLICT', { details: [{ field: 'status', rule, message }] })

function defined<T extends object>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>
}

/** Job offers (docs/backend/06 §8, 07 §4.1 and §4.2). */
export class JobService {
  /** O H R see every offer; a manager only those of their department (04 §5). */
  list(tenant: TenantContext, query: JobListQuery) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const page = await jobsIn(organizationId, trx).paginate({
        page: query.page ?? 1,
        perPage: query.perPage ?? 25,
        q: query.q,
        ...query.filter,
        departmentIds: await this.departmentScope(tenant, trx),
      })
      return { rows: page.all(), meta: page.getMeta() }
    })
  }

  /** The offer and whether it belongs to the viewer's department, for the policy. */
  find(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const job = await jobsIn(organizationId, trx).findOrFail(id)
      const scope = await this.departmentScope(tenant, trx)
      const inDepartment =
        scope !== undefined && job.departmentId !== null && scope.includes(job.departmentId)
      return { job, inDepartment }
    })
  }

  create(
    tenant: TenantContext,
    actor: User,
    input: JobInput & { title: string; contractType: ContractType },
    audit: AuditContext
  ): Promise<Job> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const jobs = jobsIn(organizationId, trx)
      await this.assertDepartment(organizationId, trx, input.departmentId)
      this.assertDocuments(input.requiredDocuments)
      const job = await jobs.create({
        ...defined(input),
        slug: await this.allocateSlug(jobs, input.title),
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'job.created',
        targetType: 'job',
        targetId: job.id,
        after: { title: job.title, slug: job.slug },
      })
      await job.refresh()
      return job
    })
  }

  /** The slug never follows a new title: published links stay valid. */
  async update(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: JobInput,
    audit: AuditContext
  ): Promise<Job> {
    const { organizationId } = tenant
    const job = await withTenant(organizationId, async (trx) => {
      const jobs = jobsIn(organizationId, trx)
      const row = await jobs.findForUpdate(id)
      if (!row) throw new AppException('E_NOT_FOUND')
      if (input.departmentId) await this.assertDepartment(organizationId, trx, input.departmentId)
      this.assertDocuments(input.requiredDocuments)
      const changes = defined(input)
      row.merge({ ...changes, updatedBy: actor.id })
      if (row.status === 'published') this.assertPublishable(row)
      await jobs.save(row)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'job.updated',
        targetType: 'job',
        targetId: id,
        after: { changedFields: Object.keys(changes) },
      })
      await row.refresh()
      return row
    })
    await careersService.forget(organizationId)
    return job
  }

  /** `draft | closed → published` with a description and an open deadline (07 §4.1). */
  publish(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    return this.transition(tenant, actor, id, audit, (job) => {
      if (job.status !== 'draft' && job.status !== 'closed') {
        throw conflict('notPublishable', 'validation.recruitment.jobNotPublishable')
      }
      this.assertPublishable(job)
      if (job.deadline && job.deadline <= DateTime.now()) {
        throw AppException.validation('deadline', 'future', 'validation.recruitment.deadline')
      }
      job.merge({ status: 'published', publishedAt: DateTime.now() })
      return 'job.published'
    })
  }

  close(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    return this.transition(tenant, actor, id, audit, (job) => {
      if (job.status !== 'published') {
        throw conflict('notPublished', 'validation.recruitment.jobNotPublished')
      }
      job.status = 'closed'
      return 'job.closed'
    })
  }

  /** A draft copy with a fresh slug, no deadline and no views. */
  duplicate(tenant: TenantContext, actor: User, id: string, audit: AuditContext): Promise<Job> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const jobs = jobsIn(organizationId, trx)
      const source = await jobs.findOrFail(id)
      const copy = await jobs.create({
        title: source.title,
        slug: await this.allocateSlug(jobs, source.title),
        departmentId: source.departmentId,
        location: source.location,
        contractType: source.contractType,
        description: source.description,
        requirements: source.requirements,
        requiredDocuments: source.requiredDocuments,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'job.duplicated',
        targetType: 'job',
        targetId: copy.id,
        after: { sourceId: id, slug: copy.slug },
      })
      await copy.refresh()
      return copy
    })
  }

  async remove(tenant: TenantContext, actor: User, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const jobs = jobsIn(organizationId, trx)
      const job = await jobs.findForUpdate(id)
      if (!job) throw new AppException('E_NOT_FOUND')
      job.merge({ deletedAt: DateTime.now(), updatedBy: actor.id })
      await jobs.save(job)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'job.deleted',
        targetType: 'job',
        targetId: id,
        before: { title: job.title, status: job.status },
      })
    })
    await careersService.forget(organizationId)
  }

  /** PNG of the public page of the offer (decision of 2026-11-23). */
  async qr(tenant: TenantContext, job: Job): Promise<Buffer> {
    const organization = await withTenant(tenant.organizationId, (trx) =>
      organizations.findActive(tenant.organizationId, trx)
    )
    if (!organization) throw new AppException('E_NOT_FOUND')
    return QRCode.toBuffer(careersJobUrl(organization.slug, job.slug), {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
    })
  }

  /** `jobs:auto-close` (docs/backend/08 §2): one failing organization does not stop the others. */
  async autoClose(at: DateTime = DateTime.now()) {
    let closed = 0
    const failed: string[] = []
    const before = at.minus({ days: AUTO_CLOSE_AFTER_DAYS })
    for (const organizationId of await organizations.activeIds()) {
      try {
        const count = await withTenant(organizationId, (trx) =>
          jobsIn(organizationId, trx).closeExpired(before)
        )
        if (count > 0) await careersService.forget(organizationId)
        closed += count
      } catch (error) {
        failed.push(organizationId)
        logger.error({ err: error, organizationId }, 'jobs.auto_close_failed')
      }
    }
    logger.info({ closed, failed: failed.length }, 'jobs.auto_close_done')
    if (failed.length > 0) {
      throw new Error(`jobs:auto-close failed for ${failed.length} organization(s)`)
    }
    return closed
  }

  private async transition(
    tenant: TenantContext,
    actor: User,
    id: string,
    audit: AuditContext,
    change: (job: Job) => string
  ): Promise<Job> {
    const { organizationId } = tenant
    const job = await withTenant(organizationId, async (trx) => {
      const jobs = jobsIn(organizationId, trx)
      const row = await jobs.findForUpdate(id)
      if (!row) throw new AppException('E_NOT_FOUND')
      const before = { status: row.status }
      const action = change(row)
      row.updatedBy = actor.id
      await jobs.save(row)
      await auditService.record(trx, this.context(tenant, audit), {
        action,
        targetType: 'job',
        targetId: id,
        before,
        after: { status: row.status },
      })
      await row.refresh()
      return row
    })
    await careersService.forget(organizationId)
    return job
  }

  /** `undefined` for O H R; the manager's own department otherwise. */
  private async departmentScope(
    tenant: TenantContext,
    trx: Parameters<Parameters<typeof withTenant>[1]>[0]
  ): Promise<string[] | undefined> {
    if (tenant.hasRole('owner', 'hr_admin', 'recruiter')) return undefined
    if (!tenant.employeeId) return []
    const employee = await employeesIn(tenant.organizationId, trx).find(tenant.employeeId)
    return employee?.departmentId ? [employee.departmentId] : []
  }

  private async allocateSlug(jobs: JobRepository, title: string) {
    await jobs.lockSlugs()
    const base = slugify(title)
    const candidates = Array.from({ length: SLUG_ATTEMPTS }, (_, index) =>
      slugCandidate(base, index + 1)
    )
    const taken = await jobs.takenSlugs(candidates)
    const slug = candidates.find((candidate) => !taken.has(candidate))
    if (!slug) throw new AppException('E_CONFLICT')
    return slug
  }

  private async assertDepartment(
    organizationId: string,
    trx: Parameters<Parameters<typeof withTenant>[1]>[0],
    departmentId: string | null | undefined
  ) {
    if (!departmentId) return
    if (!(await departmentsIn(organizationId, trx).find(departmentId))) {
      throw AppException.validation('departmentId', 'exists', 'validation.recruitment.department')
    }
  }

  private assertDocuments(documents: RequiredDocument[] | undefined) {
    if (!documents) return
    const keys = documents.map((document) => document.key)
    if (new Set(keys).size !== keys.length) {
      throw AppException.validation(
        'requiredDocuments',
        'distinct',
        'validation.recruitment.documentKeys'
      )
    }
  }

  /** Title, description and contract type (07 §4.1). */
  private assertPublishable(job: Job) {
    if (!job.description?.trim()) {
      throw AppException.validation(
        'description',
        'required',
        'validation.recruitment.descriptionRequired'
      )
    }
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new JobService()
