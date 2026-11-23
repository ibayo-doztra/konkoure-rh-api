import { DateTime } from 'luxon'
import type User from '#models/user'
import type Candidate from '#models/candidate'
import type { CandidateSource, CandidateStage } from '#models/candidate'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { newId } from '#shared/utils/crypto'
import { filesIn } from '#shared/files/file_repository'
import fileStorage from '#shared/files/file_storage'
import organizations from '#modules/organizations/repositories/organization_repository'
import employeeService from '#modules/hr/services/employee_service'
import teamCache from '#modules/hr/team_cache'
import { jobsIn } from '#modules/recruitment/repositories/job_repository'
import { candidatesIn } from '#modules/recruitment/repositories/candidate_repository'
import { alreadyApplied } from '#modules/recruitment/services/application_service'
import candidateFiles, {
  COVER_LETTER_KEY,
  CV_KEY,
  type ApplicationUploads,
} from '#modules/recruitment/candidate_files'
import { checkStageMove, splitFullName } from '#modules/recruitment/pipeline_rules'

export interface CandidateListQuery {
  page?: number
  perPage?: number
  q?: string
  filter?: { jobId?: string; stage?: CandidateStage }
}

export interface CandidateInput {
  fullName?: string
  email?: string | null
  phone?: string | null
  source?: CandidateSource | null
}

const conflict = (field: string, rule: string, message: string) =>
  new AppException('E_CONFLICT', { details: [{ field, rule, message }] })

/** Candidates for the recruitment staff (docs/backend/06 §8, 07 §4.5 to §4.7). */
export class CandidateService {
  list(tenant: TenantContext, query: CandidateListQuery) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const page = await candidatesIn(organizationId, trx).paginate({
        page: query.page ?? 1,
        perPage: query.perPage ?? 25,
        q: query.q,
        ...query.filter,
      })
      return { rows: page.all(), meta: page.getMeta() }
    })
  }

  find(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => candidatesIn(organizationId, trx).findOrFail(id))
  }

  /** Added by the staff (referral, import…): no acknowledgment e-mail, pieces optional. */
  async create(
    tenant: TenantContext,
    actor: User,
    input: CandidateInput & ApplicationUploads & { jobId: string; fullName: string },
    audit: AuditContext
  ): Promise<Candidate> {
    const { organizationId } = tenant
    const job = await withTenant(organizationId, (trx) =>
      jobsIn(organizationId, trx).find(input.jobId)
    )
    if (!job) throw AppException.validation('jobId', 'exists', 'validation.recruitment.job')
    candidateFiles.assertComplete(
      input,
      job.requiredDocuments.map((d) => ({ ...d, required: false })),
      false
    )
    const checked = await candidateFiles.check(input)
    const candidateId = newId()
    const stored = await candidateFiles.store(organizationId, candidateId, checked)
    try {
      return await withTenant(organizationId, async (trx) => {
        const candidates = candidatesIn(organizationId, trx)
        await candidates.lockJob(job.id)
        if (await candidates.alreadyApplied(job.id, input.email ?? null, input.phone ?? null)) {
          throw alreadyApplied()
        }
        const source = input.source ?? 'referral'
        const candidate = await candidates.create({
          id: candidateId,
          jobId: job.id,
          fullName: input.fullName,
          email: input.email ?? null,
          phone: input.phone ?? null,
          source,
          ...candidateFiles.columns(stored),
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        const files = filesIn(organizationId, trx)
        for (const piece of stored) {
          await files.create({
            ...piece.row,
            ownerType: 'candidate',
            ownerId: candidateId,
            uploadedBy: actor.id,
          })
        }
        await candidates.recordEvent(candidateId, 'created', actor.id, {
          source,
          documents: stored.map((piece) => piece.key),
        })
        await auditService.record(trx, this.context(tenant, audit), {
          action: 'candidate.created',
          targetType: 'candidate',
          targetId: candidateId,
          after: { jobId: job.id, source },
        })
        await candidate.refresh()
        return candidate
      })
    } catch (error) {
      await candidateFiles.discard(stored.map((piece) => piece.path))
      throw error
    }
  }

  update(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: CandidateInput,
    audit: AuditContext
  ): Promise<Candidate> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const candidates = candidatesIn(organizationId, trx)
      const candidate = await candidates.findForUpdate(id)
      if (!candidate) throw new AppException('E_NOT_FOUND')
      const email = input.email === undefined ? candidate.email : input.email
      const phone = input.phone === undefined ? candidate.phone : input.phone
      if (
        (input.email !== undefined || input.phone !== undefined) &&
        (await candidates.alreadyApplied(candidate.jobId, email, phone, id))
      ) {
        throw alreadyApplied()
      }
      const changes = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined)
      )
      candidate.merge({ ...changes, updatedBy: actor.id })
      await candidates.save(candidate)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'candidate.updated',
        targetType: 'candidate',
        targetId: id,
        after: { changedFields: Object.keys(changes) },
      })
      await candidate.refresh()
      return candidate
    })
  }

  /**
   * Hard delete (decision of 2026-11-23): the record, its notes and history
   * go; its files are erased after the commit. The journal keeps no personal data.
   */
  async remove(tenant: TenantContext, id: string, audit: AuditContext) {
    const { organizationId } = tenant
    const paths = await withTenant(organizationId, async (trx) => {
      const candidates = candidatesIn(organizationId, trx)
      const candidate = await candidates.findForUpdate(id)
      if (!candidate) throw new AppException('E_NOT_FOUND')
      const owned = [
        candidate.cvPath,
        candidate.coverLetterPath,
        ...Object.values(candidate.documents),
      ].filter((path): path is string => path !== null)
      await filesIn(organizationId, trx).forgetPaths(owned)
      await candidates.delete(candidate)
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'candidate.deleted',
        targetType: 'candidate',
        targetId: id,
        before: { jobId: candidate.jobId, stage: candidate.stage },
      })
      return owned
    })
    await candidateFiles.discard(paths)
  }

  /** Pipeline move (07 §4.5); moving back is reserved to owner and hr_admin. */
  stage(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: { stage: CandidateStage; reason?: string | null },
    audit: AuditContext
  ): Promise<Candidate> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const candidates = candidatesIn(organizationId, trx)
      const candidate = await candidates.findForUpdate(id)
      if (!candidate) throw new AppException('E_NOT_FOUND')
      const from = candidate.stage
      const move = checkStageMove(from, input.stage)
      if (!move.ok) {
        if (move.reason === 'hireEndpoint') {
          throw AppException.validation('stage', 'hire', 'validation.recruitment.useHire')
        }
        throw conflict('stage', move.reason, `validation.recruitment.${move.reason}`)
      }
      if (move.backward && !tenant.hasRole('owner', 'hr_admin')) {
        throw new AppException('E_FORBIDDEN')
      }
      candidate.merge({
        stage: input.stage,
        rejectedReason: input.stage === 'rejected' ? (input.reason ?? null) : null,
        updatedBy: actor.id,
      })
      await candidates.save(candidate)
      await candidates.recordEvent(id, 'stage_changed', actor.id, { from, to: input.stage })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'candidate.stage_changed',
        targetType: 'candidate',
        targetId: id,
        before: { stage: from },
        after: { stage: input.stage },
      })
      await candidate.refresh()
      return candidate
    })
  }

  /**
   * Hiring (07 §4.6) in one transaction: employee created within the plan's
   * quota (name, e-mail, phone, job title and department of the offer),
   * candidate `hired` and linked. The offer stays open (decision of 2026-11-23).
   */
  async hire(
    tenant: TenantContext,
    actor: User,
    id: string,
    input: { firstName?: string; lastName?: string; hireDate?: DateTime },
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    const limit = await employeeService.employeeLimit(organizationId)
    const result = await withTenant(organizationId, async (trx) => {
      const candidates = candidatesIn(organizationId, trx)
      const candidate = await candidates.findForUpdate(id)
      if (!candidate) throw new AppException('E_NOT_FOUND')
      if (candidate.stage === 'hired') {
        throw conflict('stage', 'hiredTerminal', 'validation.recruitment.hiredTerminal')
      }
      if (candidate.stage === 'rejected') {
        throw conflict('stage', 'rejected', 'validation.recruitment.hireRejected')
      }
      const job = await jobsIn(organizationId, trx).find(candidate.jobId)
      if (!job) throw new AppException('E_NOT_FOUND')
      const organization = await organizations.findActive(organizationId, trx)
      const names = splitFullName(candidate.fullName)
      const employee = await employeeService.createWithin(
        trx,
        tenant,
        actor,
        {
          firstName: input.firstName ?? names.firstName,
          lastName: input.lastName ?? names.lastName,
          email: candidate.email,
          phone: candidate.phone,
          jobTitle: job.title,
          departmentId: job.departmentId,
          hireDate:
            input.hireDate ??
            DateTime.now()
              .setZone(organization?.timezone ?? 'Africa/Conakry')
              .startOf('day'),
        },
        limit,
        audit
      )
      const from = candidate.stage
      candidate.merge({ stage: 'hired', hiredEmployeeId: employee.id, updatedBy: actor.id })
      await candidates.save(candidate)
      await candidates.recordEvent(id, 'stage_changed', actor.id, {
        from,
        to: 'hired',
        employeeId: employee.id,
      })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'candidate.hired',
        targetType: 'candidate',
        targetId: id,
        after: { employeeId: employee.id, jobId: job.id },
      })
      await candidate.refresh()
      return { candidate, employee }
    })
    await teamCache.invalidate(organizationId)
    return result
  }

  /** Signed link (15 min) to one piece, journaled (06 §8, 08 §6). */
  async documentUrl(tenant: TenantContext, candidate: Candidate, key: string, audit: AuditContext) {
    const path =
      key === CV_KEY
        ? candidate.cvPath
        : key === COVER_LETTER_KEY
          ? candidate.coverLetterPath
          : (candidate.documents[key] ?? null)
    if (!path) throw new AppException('E_NOT_FOUND')
    await withTenant(tenant.organizationId, (trx) =>
      auditService.record(trx, this.context(tenant, audit), {
        action: 'sensitive_document.viewed',
        targetType: 'candidate',
        targetId: candidate.id,
        after: { key },
      })
    )
    return fileStorage.signedUrl(path)
  }

  notes(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => candidatesIn(organizationId, trx).notesOf(id))
  }

  addNote(tenant: TenantContext, actor: User, id: string, body: string, audit: AuditContext) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const candidates = candidatesIn(organizationId, trx)
      const note = await candidates.createNote({ candidateId: id, authorId: actor.id, body })
      await candidates.recordEvent(id, 'note_added', actor.id, { noteId: note.id })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'candidate.note_added',
        targetType: 'candidate',
        targetId: id,
        after: { noteId: note.id },
      })
      await note.refresh()
      return note
    })
  }

  findNote(tenant: TenantContext, id: string, noteId: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const note = await candidatesIn(organizationId, trx).findNoteForUpdate(id, noteId)
      if (!note) throw new AppException('E_NOT_FOUND')
      return note
    })
  }

  /** 07 §4.7: a `note_deleted` event is written. */
  async removeNote(
    tenant: TenantContext,
    actor: User,
    id: string,
    noteId: string,
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const candidates = candidatesIn(organizationId, trx)
      const note = await candidates.findNoteForUpdate(id, noteId)
      if (!note) throw new AppException('E_NOT_FOUND')
      note.deletedAt = DateTime.now()
      await candidates.saveNote(note)
      await candidates.recordEvent(id, 'note_deleted', actor.id, { noteId })
      await auditService.record(trx, this.context(tenant, audit), {
        action: 'candidate.note_deleted',
        targetType: 'candidate',
        targetId: id,
        before: { noteId, authorId: note.authorId },
      })
    })
  }

  events(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    return withTenant(organizationId, (trx) => candidatesIn(organizationId, trx).eventsOf(id))
  }

  /** Job titles of the listed candidates, for the responses. */
  jobTitles(tenant: TenantContext, jobIds: string[]) {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const rows = jobIds.length === 0 ? [] : await jobsIn(organizationId, trx).titlesOf(jobIds)
      return new Map(rows.map((row) => [row.id, row.title]))
    })
  }

  private context(tenant: TenantContext, audit: AuditContext): AuditContext {
    return { ...audit, organizationId: tenant.organizationId, actorRole: tenant.primaryRole }
  }
}

export default new CandidateService()
