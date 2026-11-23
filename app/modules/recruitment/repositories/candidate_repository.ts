import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import Candidate, { type CandidateStage } from '#models/candidate'
import CandidateNote from '#models/candidate_note'
import CandidateEvent, { type CandidateEventType } from '#models/candidate_event'
import { TenantRepository } from '#shared/base/tenant_repository'

export interface CandidateListFilters {
  page: number
  perPage: number
  jobId?: string
  stage?: CandidateStage
  q?: string
}

const likePattern = (value: string) => `%${value.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`

/** Tenant-scoped candidates, with their notes and history. */
export class CandidateRepository extends TenantRepository<typeof Candidate> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(Candidate, organizationId, trx)
  }

  create(data: Partial<ModelAttributes<Candidate>>) {
    return Candidate.create({ ...data, organizationId: this.organizationId }, { client: this.trx })
  }

  paginate(filters: CandidateListFilters) {
    const query = this.query()
    if (filters.jobId) query.where('job_id', filters.jobId)
    if (filters.stage) query.where('stage', filters.stage)
    if (filters.q) {
      const pattern = likePattern(filters.q)
      query.where((search) =>
        search
          .whereRaw('lower(full_name) like ?', [pattern])
          .orWhereRaw('lower(email::text) like ?', [pattern])
      )
    }
    return query
      .orderBy('created_at', 'desc')
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.perPage)
  }

  /** Serializes the duplicate check and the insertion of one offer's applications. */
  async lockJob(jobId: string) {
    await this.trx.rawQuery('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
      `candidates:${jobId}`,
    ])
  }

  /** Same offer, same e-mail (case-insensitive) or same phone (00-HANDOFF §4). */
  async alreadyApplied(
    jobId: string,
    email: string | null,
    phone: string | null,
    exceptId?: string
  ) {
    if (!email && !phone) return false
    const query = this.query()
      .where('job_id', jobId)
      .where((same) => {
        if (email) same.orWhereRaw('lower(email::text) = ?', [email.toLowerCase()])
        if (phone) same.orWhere('phone', phone)
      })
    if (exceptId) query.whereNot('id', exceptId)
    const row = await query.select('id').first()
    return row !== null
  }

  async delete(candidate: Candidate) {
    candidate.useTransaction(this.trx)
    await candidate.delete()
  }

  notesOf(candidateId: string) {
    return CandidateNote.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('candidate_id', candidateId)
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
  }

  createNote(data: Partial<ModelAttributes<CandidateNote>>) {
    return CandidateNote.create(
      { ...data, organizationId: this.organizationId },
      { client: this.trx }
    )
  }

  findNoteForUpdate(candidateId: string, noteId: string) {
    return CandidateNote.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('candidate_id', candidateId)
      .where('id', noteId)
      .whereNull('deleted_at')
      .forUpdate()
      .first()
  }

  saveNote(note: CandidateNote) {
    note.useTransaction(this.trx)
    return note.save()
  }

  eventsOf(candidateId: string) {
    return CandidateEvent.query({ client: this.trx })
      .where('organization_id', this.organizationId)
      .where('candidate_id', candidateId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
  }

  /** `candidate_events` is insert-only (02 §7). */
  recordEvent(
    candidateId: string,
    type: CandidateEventType,
    actorId: string | null,
    payload: Record<string, unknown> = {}
  ) {
    return CandidateEvent.create(
      { organizationId: this.organizationId, candidateId, type, actorId, payload },
      { client: this.trx }
    )
  }
}

export function candidatesIn(organizationId: string, trx: TransactionClientContract) {
  return new CandidateRepository(organizationId, trx)
}
