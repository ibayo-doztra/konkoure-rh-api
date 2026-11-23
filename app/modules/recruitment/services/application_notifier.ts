import logger from '@adonisjs/core/services/logger'
import type Candidate from '#models/candidate'
import type Job from '#models/job'
import type Organization from '#models/organization'
import { dispatchMail } from '#shared/mail/dispatch_mail'
import { withTenant } from '#shared/tenant/with_tenant'
import notificationService from '#modules/notifications/services/notification_service'
import { membersIn, type MailAccount } from '#modules/organizations/repositories/member_repository'
import {
  ApplicationReceivedMail,
  CandidateAppliedMail,
} from '#modules/recruitment/mails/application_mails'

/**
 * Application e-mails and notifications (docs/backend/08 §4, 07 §8), after
 * the commit. A failure is logged, never raised: the application is saved.
 */
export class ApplicationNotifier {
  /**
   * `candidate_applied` + `candidate.applied` to the recruiters (else the
   * hr_admins, else the owners), and `application_received` to the candidate.
   */
  async applied(organization: Organization, job: Job, candidate: Candidate) {
    try {
      const recipients = await withTenant(organization.id, async (trx) => {
        const members = membersIn(organization.id, trx)
        let accounts: MailAccount[] = await members.accountsWithRole('recruiter')
        if (accounts.length === 0) accounts = await members.accountsWithRole('hr_admin')
        if (accounts.length === 0) accounts = await members.accountsWithRole('owner')
        return accounts
      })
      for (const recipient of recipients) {
        await dispatchMail(
          new CandidateAppliedMail(recipient, {
            jobTitle: job.title,
            candidateName: candidate.fullName,
          })
        )
      }
      await notificationService.notify(
        organization.id,
        recipients,
        {
          type: 'candidate.applied',
          key: 'candidateApplied',
          data: { candidateName: candidate.fullName, jobTitle: job.title },
          link: `/recruitment/candidates/${candidate.id}`,
          payload: { candidateId: candidate.id, jobId: job.id },
        },
        null
      )
      if (candidate.email) {
        await dispatchMail(
          new ApplicationReceivedMail(
            {
              email: candidate.email,
              fullName: candidate.fullName,
              preferredLanguage: organization.defaultLanguage,
            },
            { jobTitle: job.title, organizationName: organization.name }
          )
        )
      }
    } catch (error) {
      logger.error({ err: error, candidateId: candidate.id }, 'candidate.notify_failed')
    }
  }
}

export default new ApplicationNotifier()
