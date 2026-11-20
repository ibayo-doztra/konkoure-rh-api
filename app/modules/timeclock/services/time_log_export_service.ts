import { DateTime } from 'luxon'
import limiter from '@adonisjs/limiter/services/main'
import type User from '#models/user'
import type { PunchAnomaly, PunchSource } from '#models/time_log'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import organizations from '#modules/organizations/repositories/organization_repository'
import { writeCsv, writeXlsx, type SheetFormat } from '#modules/hr/import/spreadsheet'
import { timeLogsIn, type ExportRow } from '#modules/timeclock/repositories/time_log_repository'
import { assertRange } from '#modules/timeclock/services/attendance_service'
import { localDay } from '#modules/timeclock/attendance_rules'

/** Bounds of the synchronous export (lot 2 decision). */
export const MAX_EXPORT_DAYS = 31
export const MAX_EXPORT_ROWS = 50_000
const EXPORTS_PER_HOUR = 10
const PAGE_SIZE = 500

export interface TimeLogExportQuery {
  format: SheetFormat
  filter: {
    from: DateTime
    to: DateTime
    employeeId?: string
    source?: PunchSource
    anomaly?: PunchAnomaly
  }
}

type Locale = 'fr' | 'en'

const COLUMNS = [
  { fr: 'Matricule', en: 'Employee number' },
  { fr: 'Nom', en: 'Last name' },
  { fr: 'Prénom', en: 'First name' },
  { fr: 'Type', en: 'Type' },
  { fr: 'Date', en: 'Date' },
  { fr: 'Heure', en: 'Time' },
  { fr: 'Source', en: 'Source' },
  { fr: 'Zone', en: 'Zone' },
  { fr: 'Dans la zone', en: 'Within zone' },
  { fr: 'Anomalie', en: 'Anomaly' },
  { fr: 'Notes', en: 'Notes' },
] as const

const YES_NO: Record<Locale, [string, string]> = { fr: ['oui', 'non'], en: ['yes', 'no'] }

/**
 * GET /org/timeclock/logs/export (06 §6, lot 2 decision): a synchronous CSV or
 * XLSX file of at most 31 days and 50,000 punches, times in the organization's
 * timezone. Owner and hr_admin only; audited.
 */
export class TimeLogExportService {
  async build(
    tenant: TenantContext,
    actor: User,
    query: TimeLogExportQuery,
    locale: Locale,
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    const { filter } = query
    const result = await withTenant(organizationId, async (trx) => {
      const organization = await organizations.findActive(organizationId, trx)
      if (!organization) throw new AppException('E_NOT_FOUND')
      const timezone = organization.timezone
      const from = localDay(filter.from, timezone)
      const to = localDay(filter.to, timezone)
      assertRange(from, to, MAX_EXPORT_DAYS, 'validation.timeclock.exportRange')

      const logs = timeLogsIn(organizationId, trx)
      const filters = {
        from: filter.from.toISO()!,
        to: filter.to.toISO()!,
        employeeId: filter.employeeId,
        source: filter.source,
        anomaly: filter.anomaly,
      }
      const total = await logs.exportCount(filters)
      if (total > MAX_EXPORT_ROWS) {
        throw AppException.validation(
          'filter',
          'tooManyRows',
          'validation.timeclock.exportTooLarge'
        )
      }
      // Counted before the limiter, so a refused export does not consume the budget.
      await limiter
        .use({ requests: EXPORTS_PER_HOUR, duration: '1 hour' })
        .consume(`time-logs-export:${actor.id}`)

      const rows: string[][] = [COLUMNS.map((column) => column[locale])]
      for (let offset = 0; offset < total; offset += PAGE_SIZE) {
        const page = await logs.exportPage(filters, offset, PAGE_SIZE)
        for (const row of page) rows.push(this.line(row, timezone, locale))
        if (page.length < PAGE_SIZE) break
      }

      await auditService.record(
        trx,
        { ...audit, organizationId, actorRole: tenant.primaryRole },
        {
          action: 'time_log.exported',
          targetType: 'organization',
          targetId: organizationId,
          after: { format: query.format, filters, rows: rows.length - 1 },
        }
      )
      return { rows, from, to }
    })

    const content =
      query.format === 'csv' ? writeCsv(result.rows) : await writeXlsx(result.rows, 'Pointages')
    return {
      content,
      filename: `pointages_${result.from}_${result.to}.${query.format}`,
      contentType:
        query.format === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }
  }

  private line(row: ExportRow, timezone: string, locale: Locale): string[] {
    const at = DateTime.fromJSDate(row.punchedAt).setZone(timezone)
    const [yes, no] = YES_NO[locale]
    return [
      row.employeeNumber ?? '',
      row.lastName,
      row.firstName,
      row.type,
      at.toISODate()!,
      at.toFormat('HH:mm:ss'),
      row.source,
      row.zoneName ?? '',
      row.isWithinZone ? yes : no,
      row.anomaly ?? '',
      row.notes ?? '',
    ]
  }
}

export default new TimeLogExportService()
