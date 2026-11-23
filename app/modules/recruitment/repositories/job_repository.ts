import type { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import Job, { type JobStatus } from '#models/job'
import { TenantRepository } from '#shared/base/tenant_repository'

export interface JobListFilters {
  page: number
  perPage: number
  status?: JobStatus
  departmentId?: string
  q?: string
  /** A manager reads the offers of their department only (04 §5). */
  departmentIds?: string[]
}

const likePattern = (value: string) => `%${value.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`

/** Tenant-scoped job offers. */
export class JobRepository extends TenantRepository<typeof Job> {
  protected readonly softDeletes = true

  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Job, organizationId, trx)
  }

  create(data: Partial<ModelAttributes<Job>>) {
    return Job.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  paginate(filters: JobListFilters) {
    const query = this.query()
    if (filters.departmentIds) query.whereIn('department_id', filters.departmentIds)
    if (filters.status) query.where('status', filters.status)
    if (filters.departmentId) query.where('department_id', filters.departmentId)
    if (filters.q) query.whereRaw('lower(title) like ?', [likePattern(filters.q)])
    return query
      .orderBy('created_at', 'desc')
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.perPage)
  }

  /** Serializes slug allocation within the organization. */
  async lockSlugs() {
    await this.trx.rawQuery('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
      `job_slugs:${this.organizationId}`,
    ])
  }

  /** Slugs already used, deleted offers included (the index covers them). */
  async takenSlugs(candidates: string[]): Promise<Set<string>> {
    const rows = await Job.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .whereIn('slug', candidates)
      .select('slug')
    return new Set(rows.map((row) => row.slug))
  }

  /** Any live offer of the organization by slug, whatever its status (applications). */
  bySlug(slug: string) {
    return this.query().where('slug', slug).first()
  }

  titlesOf(ids: string[]) {
    return this.query().whereIn('id', ids).select('id', 'title')
  }

  /** Offers shown publicly: published and not past their deadline (07 §4.2). */
  publicQuery(now: DateTime) {
    return this.query()
      .where('status', 'published')
      .where((open) => open.whereNull('deadline').orWhere('deadline', '>', now.toUTC().toISO()!))
  }

  publicList(now: DateTime) {
    return this.publicQuery(now).orderBy('published_at', 'desc').orderBy('id', 'asc')
  }

  publicBySlug(slug: string, now: DateTime) {
    return this.publicQuery(now).where('slug', slug).first()
  }

  async countView(id: string) {
    await Job.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('id', id)
      .increment('views_count', 1)
  }

  /** `jobs:auto-close` (08 §2): published offers past their deadline by `before`. */
  async closeExpired(before: DateTime) {
    const rows = await this.query()
      .where('status', 'published')
      .whereNotNull('deadline')
      .where('deadline', '<', before.toUTC().toISO()!)
      .select('id')
    if (rows.length === 0) return 0
    await Job.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .whereIn(
        'id',
        rows.map((row) => row.id)
      )
      .update({ status: 'closed' })
    return rows.length
  }
}

export function jobsIn(organizationId: string, trx: TransactionClientContract) {
  return new JobRepository(organizationId, trx)
}
