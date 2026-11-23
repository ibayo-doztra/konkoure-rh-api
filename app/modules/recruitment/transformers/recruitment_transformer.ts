import type Job from '#models/job'
import type Candidate from '#models/candidate'
import type CandidateNote from '#models/candidate_note'
import type CandidateEvent from '#models/candidate_event'

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

/**
 * Candidate for the recruitment staff (06 §8): AI signals included, storage
 * paths never; `documents` lists the keys of the stored pieces, each read
 * through `GET …/documents/:key/url`.
 */
export function candidateDto(candidate: Candidate, jobTitle: string | null) {
  const documents = [
    ...(candidate.cvPath ? ['cv'] : []),
    ...(candidate.coverLetterPath ? ['cover_letter'] : []),
    ...Object.keys(candidate.documents),
  ]
  return {
    id: candidate.id,
    jobId: candidate.jobId,
    jobTitle,
    fullName: candidate.fullName,
    email: candidate.email,
    phone: candidate.phone,
    stage: candidate.stage,
    source: candidate.source,
    documents,
    aiScore: candidate.aiScore,
    aiJustification: candidate.aiJustification,
    aiStrengths: candidate.aiStrengths,
    aiWeaknesses: candidate.aiWeaknesses,
    aiCandidateName: candidate.aiCandidateName,
    aiIsValidCv: candidate.aiIsValidCv,
    aiFraudAlert: candidate.aiFraudAlert,
    aiScoredAt: iso(candidate.aiScoredAt),
    rejectedReason: candidate.rejectedReason,
    hiredEmployeeId: candidate.hiredEmployeeId,
    createdAt: candidate.createdAt.toUTC().toISO(),
    updatedAt: candidate.updatedAt.toUTC().toISO(),
  }
}

export function candidateNoteDto(note: CandidateNote) {
  return {
    id: note.id,
    candidateId: note.candidateId,
    authorId: note.authorId,
    body: note.body,
    createdAt: note.createdAt.toUTC().toISO(),
  }
}

export function candidateEventDto(event: CandidateEvent) {
  return {
    id: event.id,
    type: event.type,
    actorId: event.actorId,
    payload: event.payload,
    createdAt: event.createdAt.toUTC().toISO(),
  }
}
