import logger from '@adonisjs/core/services/logger'
import drive from '@adonisjs/drive/services/main'
import { DateTime } from 'luxon'
import auditService from '#shared/audit/audit_service'
import { diskFor, type Space } from '#shared/files/storage_disks'
import { withTenant } from '#shared/tenant/with_tenant'
import entitlementService from '#modules/billing/services/entitlement_service'
import purges from '#modules/organizations/repositories/organization_purge_repository'

/** A deleted organization can be restored for 30 days (06 §3), then it is purged. */
export const PURGE_AFTER_DAYS = 30
const BATCH = 20
const SPACES: Space[] = ['private', 'public']

/**
 * `organizations.purge` (daily, decision of 2026-11-26): 30 days after
 * `DELETE /org`, deletes the stored files of the organization and all its
 * tenant rows except payments, invoices, subscriptions and audit logs; the
 * organization row stays, anonymized, with `purged_at`. User accounts are
 * kept, only their roles go. Invoice PDFs live under `invoices/<orgId>/` and
 * are kept. Files go first, outside any transaction: if storage fails, the
 * organization is left untouched and retried on the next run.
 */
export class OrganizationPurgeService {
  async run(at: DateTime = DateTime.now()) {
    const before = at.minus({ days: PURGE_AFTER_DAYS }).toJSDate()
    let purged = 0
    let failed = 0
    const skipped = new Set<string>()
    for (;;) {
      const rows = await purges.due(before, BATCH + skipped.size)
      const due = rows.filter((row) => !skipped.has(row.id))
      if (due.length === 0) break
      for (const organization of due) {
        try {
          if (await this.purge(organization.id, before, at.toJSDate())) purged++
        } catch (error) {
          failed++
          skipped.add(organization.id)
          logger.error(
            { err: error, organizationId: organization.id },
            'organizations.purge_failed'
          )
        }
      }
      if (due.length < BATCH) break
    }
    logger.info({ purged, failed }, 'organizations.purge_done')
    return purged
  }

  /** Purges one organization; false when it was restored or purged meanwhile. */
  private async purge(organizationId: string, before: Date, at: Date) {
    for (const space of SPACES) {
      await drive.use(diskFor(space)).deleteAll(`${organizationId}/`)
    }
    const done = await withTenant(organizationId, async (trx) => {
      const organization = await purges.lockPending(organizationId, before, trx)
      if (!organization) return false
      const counts = await purges.deleteTenantRows(organizationId, trx)
      await purges.anonymize(organizationId, at, trx)
      await auditService.record(
        trx,
        { organizationId, actorRole: 'system' },
        {
          action: 'organization.purged',
          targetType: 'organization',
          targetId: organizationId,
          before: { name: organization.name, slug: organization.slug },
          after: { deletedRows: counts },
        }
      )
      return true
    })
    if (done) await entitlementService.invalidate(organizationId)
    return done
  }
}

export default new OrganizationPurgeService()
