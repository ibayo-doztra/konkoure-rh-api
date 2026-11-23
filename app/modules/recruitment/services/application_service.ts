import { DateTime } from 'luxon'
import limiter from '@adonisjs/limiter/services/main'
import type Job from '#models/job'
import type Organization from '#models/organization'
import { AppException } from '#shared/exceptions/app_exception'
import { newId } from '#shared/utils/crypto'
import { withTenant } from '#shared/tenant/with_tenant'
import { filesIn } from '#shared/files/file_repository'
import { jobsIn } from '#modules/recruitment/repositories/job_repository'
import { candidatesIn } from '#modules/recruitment/repositories/candidate_repository'
import careersService from '#modules/recruitment/services/careers_service'
import applicationNotifier from '#modules/recruitment/services/application_notifier'
import candidateFiles, { type ApplicationUploads } from '#modules/recruitment/candidate_files'

export interface ApplicationInput extends ApplicationUploads {
  fullName: string
  email: string
  phone: string
}

/** Public budgets of 05 §4: 5 applications / hour / IP, 3 / hour / e-mail. */
const byIp = () => limiter.use({ requests: 5, duration: '1 hour' })
const byEmail = () => limiter.use({ requests: 3, duration: '1 hour' })

export const alreadyApplied = () =>
  new AppException('E_CONFLICT', {
    details: [
      { field: 'email', rule: 'already_applied', message: 'validation.recruitment.alreadyApplied' },
    ],
  })

/**
 * Public applications (docs/backend/06 §11, 07 §4.3, 05 §4). Duplicates
 * (same offer, same e-mail or phone, 00-HANDOFF §4) are refused before any
 * file is stored; the pre-check lets the form stop before sending them.
 */
export class ApplicationService {
  /** `POST …/apply/check` (decision of 2026-11-23). */
  async check(orgSlug: string, jobSlug: string, email: string, phone: string) {
    const { organization, job } = await this.openJob(orgSlug, jobSlug)
    const taken = await withTenant(organization.id, (trx) =>
      candidatesIn(organization.id, trx).alreadyApplied(job.id, email, phone)
    )
    if (taken) throw alreadyApplied()
  }

  async apply(orgSlug: string, jobSlug: string, input: ApplicationInput, ip: string) {
    await this.consume(ip, input.email)
    const { organization, job } = await this.openJob(orgSlug, jobSlug)
    candidateFiles.assertComplete(input, job.requiredDocuments, true)

    // Fail closed: a duplicate never reaches the storage nor the scoring.
    if (
      await withTenant(organization.id, (trx) =>
        candidatesIn(organization.id, trx).alreadyApplied(job.id, input.email, input.phone)
      )
    ) {
      throw alreadyApplied()
    }

    const checked = await candidateFiles.check(input)
    const candidateId = newId()
    const stored = await candidateFiles.store(organization.id, candidateId, checked)
    let candidate
    try {
      candidate = await withTenant(organization.id, async (trx) => {
        const candidates = candidatesIn(organization.id, trx)
        await candidates.lockJob(job.id)
        if (await candidates.alreadyApplied(job.id, input.email, input.phone))
          throw alreadyApplied()
        const row = await candidates.create({
          id: candidateId,
          jobId: job.id,
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          source: 'careers',
          ...candidateFiles.columns(stored),
        })
        const files = filesIn(organization.id, trx)
        for (const piece of stored) {
          await files.create({ ...piece.row, ownerType: 'candidate', ownerId: candidateId })
        }
        await candidates.recordEvent(candidateId, 'created', null, {
          source: 'careers',
          documents: stored.map((piece) => piece.key),
        })
        await row.refresh()
        return row
      })
    } catch (error) {
      await candidateFiles.discard(stored.map((piece) => piece.path))
      throw error
    }
    await applicationNotifier.applied(organization, job, candidate)
    return candidate
  }

  /**
   * An offer that accepts applications: unknown or draft ⇒ 404; closed or
   * past its deadline ⇒ 410 E_JOB_CLOSED (07 §4.2).
   */
  private async openJob(
    orgSlug: string,
    jobSlug: string
  ): Promise<{ organization: Organization; job: Job }> {
    const organization = await careersService.organization(orgSlug)
    const job = await withTenant(organization.id, (trx) =>
      jobsIn(organization.id, trx).bySlug(jobSlug)
    )
    if (!job || job.status === 'draft') throw new AppException('E_NOT_FOUND')
    const expired = job.deadline !== null && job.deadline <= DateTime.now()
    if (job.status !== 'published' || expired) throw new AppException('E_JOB_CLOSED')
    return { organization, job }
  }

  private async consume(ip: string, email: string) {
    for (const [store, key] of [
      [byIp(), `apply:ip:${ip}`],
      [byEmail(), `apply:email:${email.toLowerCase()}`],
    ] as const) {
      if ((await store.remaining(key)) <= 0) {
        throw new AppException('E_RATE_LIMITED', { retryAfter: await store.availableIn(key) })
      }
      await store.increment(key)
    }
  }
}

export default new ApplicationService()
