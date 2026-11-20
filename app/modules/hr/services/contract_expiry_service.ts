import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import redis from '@adonisjs/redis/services/main'
import { dispatchMail } from '#shared/mail/dispatch_mail'
import notificationService from '#modules/notifications/services/notification_service'
import { withTenant } from '#shared/tenant/with_tenant'
import organizations from '#modules/organizations/repositories/organization_repository'
import { membersIn, type MailAccount } from '#modules/organizations/repositories/member_repository'
import { contractsIn } from '#modules/hr/repositories/contract_repository'
import { ContractExpiringMail } from '#modules/hr/mails/contract_expiring_mail'

/** Notice period of `contracts:expiring` (08 §2). */
const NOTICE_DAYS = 30
/** The marker outlives the notice window, so a contract is announced once per end date. */
const MARKER_TTL_SECONDS = (NOTICE_DAYS + 10) * 24 * 3600

/**
 * `contracts:expiring` (docs/backend/08 §2, §4): every active contract ending
 * within 30 days is announced once to the hr_admins, else the owners. Covering
 * the whole window catches up a missed night; a Redis marker per contract and
 * end date keeps it to one e-mail.
 */
export class ContractExpiryService {
  async run(at: DateTime = DateTime.now()) {
    let announced = 0
    const failed: string[] = []
    for (const organizationId of await organizations.activeIds()) {
      try {
        announced += await this.organization(organizationId, at)
      } catch (error) {
        failed.push(organizationId)
        logger.error({ err: error, organizationId }, 'contracts.expiring_failed')
      }
    }
    logger.info({ announced, failed: failed.length }, 'contracts.expiring_done')
    if (failed.length > 0) {
      throw new Error(`contracts:expiring failed for ${failed.length} organization(s)`)
    }
    return announced
  }

  private async organization(organizationId: string, at: DateTime) {
    const { ending, recipients } = await withTenant(organizationId, async (trx) => {
      const none: MailAccount[] = []
      const organization = await organizations.findActive(organizationId, trx)
      if (!organization) return { ending: [], recipients: none }
      const today = at.setZone(organization.timezone).startOf('day')
      const rows = await contractsIn(organizationId, trx).endingBetween(
        today.plus({ days: 1 }).toISODate()!,
        today.plus({ days: NOTICE_DAYS }).toISODate()!
      )
      if (rows.length === 0) return { ending: rows, recipients: none }
      const members = membersIn(organizationId, trx)
      let accounts = await members.accountsWithRole('hr_admin')
      if (accounts.length === 0) accounts = await members.accountsWithRole('owner')
      return { ending: rows, recipients: accounts }
    })

    let announced = 0
    for (const { contract, employeeName } of ending) {
      const endDate = contract.endDate!.toISODate()!
      if (!(await this.claim(contract.id, endDate))) continue
      for (const recipient of recipients) {
        await dispatchMail(new ContractExpiringMail(recipient, { employeeName, endDate }))
      }
      await notificationService.notify(
        organizationId,
        recipients,
        {
          type: 'contract.expiring',
          key: 'contractExpiring',
          data: { employeeName, endDate },
          link: `/employees/${contract.employeeId}`,
          payload: { contractId: contract.id, employeeId: contract.employeeId, endDate },
        },
        null
      )
      announced += 1
    }
    return announced
  }

  /** First run for this contract and end date. A Redis outage sends rather than stays silent. */
  private async claim(contractId: string, endDate: string) {
    try {
      const set = await redis
        .connection('cache')
        .set(`contract_expiring:${contractId}:${endDate}`, '1', 'EX', MARKER_TTL_SECONDS, 'NX')
      return set === 'OK'
    } catch (error) {
      logger.warn({ err: error }, 'contracts.expiring_marker_unavailable')
      return true
    }
  }
}

export default new ContractExpiryService()
