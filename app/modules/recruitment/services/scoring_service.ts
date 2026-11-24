import { createHash, timingSafeEqual } from 'node:crypto'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import receipts from '#shared/webhooks/receipt_repository'
import { withTenant } from '#shared/tenant/with_tenant'
import fileStorage from '#shared/files/file_storage'
import outbound, { signBody } from '#shared/http/outbound'
import queueService from '#shared/queue/queue_service'
import { AppException } from '#shared/exceptions/app_exception'
import aiCreditService from '#modules/billing/services/ai_credit_service'
import notificationService from '#modules/notifications/services/notification_service'
import organizations from '#modules/organizations/repositories/organization_repository'
import { membersIn, type MailAccount } from '#modules/organizations/repositories/member_repository'
import { jobsIn } from '#modules/recruitment/repositories/job_repository'
import { candidatesIn } from '#modules/recruitment/repositories/candidate_repository'
import { webhookConfigIn } from '#modules/recruitment/repositories/webhook_config_repository'
import webhookConfigService from '#modules/recruitment/services/webhook_config_service'
import { COVER_LETTER_KEY, CV_KEY } from '#modules/recruitment/candidate_files'
import { normalizeN8nResponse, type ScoringResult } from '#modules/recruitment/scoring/n8n_response'

/** Signed links sent to n8n last one hour (07 §4.4, 08 §6). */
const N8N_URL_TTL_SECONDS = 60 * 60
/** Inbound timestamps older or newer than 5 minutes are replays (05 §11). */
const MAX_CLOCK_SKEW_SECONDS = 5 * 60

export const N8N_PROVIDER = 'n8n_scoring'

export interface ScoreJob {
  organizationId: string
  candidateId: string
  /** Month of the AI credit reserved for this scoring, to give it back on failure. */
  creditPeriod?: string
}

export type InboundOutcome = 'accepted' | 'duplicate' | 'invalid_signature'

/**
 * AI scoring of applications through n8n (docs/backend/07 §4.4, 08 §5).
 * Triggered **only** by a public application: no manual scoring or re-run
 * exists anywhere. Results are advisory: no stage change, no rejection.
 */
export class ScoringService {
  /**
   * After the commit of a public application. One AI credit (07 §6.8) is
   * reserved here; with the month's credits used up, the workflow is not
   * called and a `scoring_skipped` event says why (decision of 2026-11-24).
   */
  async schedule(organizationId: string, candidateId: string) {
    try {
      const config = await withTenant(organizationId, (trx) =>
        webhookConfigIn(organizationId, trx).find()
      )
      if (!config || config.activeEnv === 'off') return
      if (!webhookConfigService.urlOf(config, config.activeEnv)) return
      let creditPeriod: string
      try {
        const reservation = await aiCreditService.reserve(organizationId)
        creditPeriod = reservation.period
      } catch (error) {
        if (!(error instanceof AppException) || error.code !== 'E_AI_QUOTA_EXCEEDED') throw error
        await withTenant(organizationId, (trx) =>
          candidatesIn(organizationId, trx).recordEvent(candidateId, 'scoring_skipped', null, {
            reason: 'ai_quota',
          })
        )
        logger.warn({ organizationId, candidateId }, 'candidate.scoring_skipped_quota')
        return
      }
      await queueService.dispatch('candidates.score', { organizationId, candidateId, creditPeriod })
    } catch (error) {
      logger.error({ err: error, candidateId }, 'candidate.scoring_schedule_failed')
    }
  }

  /**
   * The `candidates.score` job: signed call to the active n8n webhook. A
   * transport error or a non-2xx answer throws, so the queue retries
   * (30 s, 5 min, 30 min); a 2xx answer carrying a result is applied at once,
   * otherwise n8n answers later on `/webhooks/n8n/scoring`.
   */
  async run(payload: ScoreJob) {
    const { organizationId, candidateId } = payload
    const context = await withTenant(organizationId, async (trx) => {
      const config = await webhookConfigIn(organizationId, trx).find()
      const candidate = await candidatesIn(organizationId, trx).find(candidateId)
      if (!config || config.activeEnv === 'off' || !candidate) return null
      const job = await jobsIn(organizationId, trx).find(candidate.jobId)
      const organization = await organizations.findActive(organizationId, trx)
      if (!job || !organization) return null
      return { config, candidate, job, organization }
    })
    if (!context) {
      await this.giveUp(payload)
      return 'skipped'
    }
    const { config, candidate, job, organization } = context
    const environment = config.activeEnv as 'test' | 'prod'
    const url = webhookConfigService.urlOf(config, environment)
    const secret = webhookConfigService.secretOf(config)
    if (!url || !secret) {
      await this.giveUp(payload)
      return 'skipped'
    }

    const pieces: Array<[string, string | null]> = [
      [CV_KEY, candidate.cvPath],
      [COVER_LETTER_KEY, candidate.coverLetterPath],
      ...Object.entries(candidate.documents),
    ]
    const documents = []
    for (const [key, path] of pieces) {
      if (!path) continue
      const { url: signed } = await fileStorage.signedUrl(path, N8N_URL_TTL_SECONDS)
      documents.push({ key, url: signed })
    }
    const callback = new URL('/api/v1/webhooks/n8n/scoring', env.get('APP_URL'))
    callback.searchParams.set('organizationId', organizationId)
    callback.searchParams.set('candidateId', candidateId)

    // No e-mail, phone or other personal field beyond what scoring needs (08 §7).
    const result = await outbound.postSigned(
      url,
      {
        event: 'candidate.applied',
        environment,
        organization: { id: organization.id, name: organization.name },
        job: {
          id: job.id,
          title: job.title,
          description: job.description,
          requirements: job.requirements,
          location: job.location,
          contractType: job.contractType,
        },
        candidate: { id: candidate.id, fullName: candidate.fullName, documents },
        callback: { url: callback.toString() },
      },
      secret
    )
    if (result.error || result.status === null || result.status >= 300) {
      throw new Error(`n8n scoring call failed: ${result.error ?? result.status}`)
    }
    if (payload.creditPeriod) {
      await aiCreditService.record({
        organizationId,
        userId: null,
        kind: 'ai',
        module: 'recruitment',
        path: null,
        metadata: { task: 'candidate.score', provider: 'n8n', cost: 1, candidateId },
      })
    }
    let parsed: unknown = null
    try {
      parsed = result.body ? JSON.parse(result.body) : null
    } catch {
      parsed = null
    }
    const scoring = normalizeN8nResponse(parsed)
    if (scoring) await this.apply(organizationId, candidateId, scoring)
    return scoring ? 'scored' : 'awaiting_callback'
  }

  /** The last attempt of `candidates.score` failed: the reserved AI credit is given back. */
  async giveUp({ organizationId, candidateId, creditPeriod }: ScoreJob) {
    if (!creditPeriod) return
    await aiCreditService.refund({ organizationId, period: creditPeriod })
    logger.warn({ organizationId, candidateId }, 'candidate.scoring_given_up')
  }

  /**
   * `POST /webhooks/n8n/scoring` (05 §11): HMAC of the raw body with the
   * organization's secret, timestamp within 5 minutes, one receipt per event,
   * then processed by the queue.
   */
  async receive(input: {
    organizationId: string
    candidateId: string
    rawBody: string
    signature: string | undefined
    timestamp: string | undefined
  }): Promise<InboundOutcome> {
    const { organizationId, candidateId, rawBody } = input
    const organization = await organizations.findActive(organizationId)
    const config = organization
      ? await withTenant(organizationId, (trx) => webhookConfigIn(organizationId, trx).find())
      : null
    const secret = config ? webhookConfigService.secretOf(config) : null
    const timestamp = Number(input.timestamp)
    const fresh =
      Number.isFinite(timestamp) &&
      Math.abs(Date.now() / 1000 - timestamp) <= MAX_CLOCK_SKEW_SECONDS
    if (!secret || !fresh || !this.signatureMatches(rawBody, secret, input.signature)) {
      logger.warn({ organizationId, candidateId, fresh }, 'n8n.scoring_signature_rejected')
      return 'invalid_signature'
    }

    let body: unknown = null
    try {
      body = JSON.parse(rawBody)
    } catch {
      body = rawBody
    }
    const eventId = createHash('sha256')
      .update(`${organizationId}:${candidateId}:${rawBody}`)
      .digest('hex')
    const receiptId = await receipts.record(N8N_PROVIDER, eventId, {
      organizationId,
      candidateId,
      body,
    })
    if (!receiptId) return 'duplicate'
    await queueService.dispatch('candidates.score-result', { receiptId })
    return 'accepted'
  }

  /** The `candidates.score-result` job: a non-conforming body keeps the stored values (07 §4.4). */
  async processReceipt({ receiptId }: { receiptId: string }) {
    const receipt = await receipts.find(receiptId)
    if (!receipt || receipt.processedAt) return 'skipped'
    const { organizationId, candidateId, body } = receipt.payload as {
      organizationId: string
      candidateId: string
      body: unknown
    }
    const scoring = normalizeN8nResponse(body)
    if (scoring) {
      await this.apply(organizationId, candidateId, scoring)
    } else {
      logger.warn({ candidateId, receiptId }, 'n8n.scoring_payload_invalid')
    }
    receipt.merge({ processedAt: DateTime.now(), error: scoring ? null : 'invalid_payload' })
    await receipts.save(receipt)
    return scoring ? 'scored' : 'invalid_payload'
  }

  /** Writes the AI columns, an event, and tells the recruiters (08 §3 `candidate:scored`). */
  async apply(organizationId: string, candidateId: string, scoring: ScoringResult) {
    const candidate = await withTenant(organizationId, async (trx) => {
      const candidates = candidatesIn(organizationId, trx)
      const row = await candidates.findForUpdate(candidateId)
      if (!row) return null
      row.merge({ ...scoring, aiScoredAt: DateTime.now() })
      await candidates.save(row)
      await candidates.recordEvent(candidateId, 'scored', null, { score: scoring.aiScore })
      return row
    })
    if (!candidate) return
    try {
      const recipients = await withTenant(organizationId, async (trx) => {
        const members = membersIn(organizationId, trx)
        let accounts: MailAccount[] = await members.accountsWithRole('recruiter')
        if (accounts.length === 0) accounts = await members.accountsWithRole('hr_admin')
        if (accounts.length === 0) accounts = await members.accountsWithRole('owner')
        return accounts
      })
      await notificationService.notify(
        organizationId,
        recipients,
        {
          type: 'candidate.scored',
          key: 'candidateScored',
          data: { candidateName: candidate.fullName, score: String(scoring.aiScore) },
          link: `/recruitment/candidates/${candidateId}`,
          payload: { candidateId, score: scoring.aiScore },
        },
        null
      )
    } catch (error) {
      logger.error({ err: error, candidateId }, 'candidate.scored_notify_failed')
    }
  }

  private signatureMatches(rawBody: string, secret: string, received: string | undefined) {
    if (!received) return false
    const expected = Buffer.from(signBody(rawBody, secret), 'hex')
    const given = Buffer.from(received.replace(/^sha256=/, ''), 'hex')
    return given.length === expected.length && timingSafeEqual(given, expected)
  }
}

export default new ScoringService()
