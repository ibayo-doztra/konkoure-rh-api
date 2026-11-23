import type Job from '#models/job'

const iso = (value: { toUTC(): { toISO(): string | null } } | null) =>
  value ? value.toUTC().toISO() : null

/** Offer as seen by the recruitment staff (06 §8). */
export function jobDto(job: Job) {
  return {
    id: job.id,
    title: job.title,
    slug: job.slug,
    departmentId: job.departmentId,
    location: job.location,
    contractType: job.contractType,
    description: job.description,
    requirements: job.requirements,
    status: job.status,
    publishedAt: iso(job.publishedAt),
    deadline: iso(job.deadline),
    requiredDocuments: job.requiredDocuments,
    inclusiveScore: job.inclusiveScore,
    viewsCount: job.viewsCount,
    createdAt: job.createdAt.toUTC().toISO(),
    updatedAt: job.updatedAt.toUTC().toISO(),
  }
}

/**
 * Public card of an offer (05 §4): no internal ids beyond the slug, no
 * counters, no author.
 */
export function publicJobSummaryDto(job: Job, departments: Map<string, string>) {
  return {
    slug: job.slug,
    title: job.title,
    department: job.departmentId ? (departments.get(job.departmentId) ?? null) : null,
    location: job.location,
    contractType: job.contractType,
    publishedAt: iso(job.publishedAt),
    deadline: iso(job.deadline),
  }
}

export function publicJobDto(job: Job, departments: Map<string, string>) {
  return {
    ...publicJobSummaryDto(job, departments),
    description: job.description,
    requirements: job.requirements,
    requiredDocuments: job.requiredDocuments,
  }
}
