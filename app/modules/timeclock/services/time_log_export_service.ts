import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { DateTime } from 'luxon'
import ExcelJS from 'exceljs'
import limiter from '@adonisjs/limiter/services/main'
import type User from '#models/user'
import type { PunchAnomaly, PunchSource } from '#models/time_log'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { filesIn } from '#shared/files/file_repository'
import fileStorage from '#shared/files/file_storage'
import { dispatchMail } from '#shared/mail/dispatch_mail'
import queueService from '#shared/queue/queue_service'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import { newId } from '#shared/utils/crypto'
import users from '#modules/users/repositories/user_repository'
import organizations from '#modules/organizations/repositories/organization_repository'
import { CSV_BOM, csvLine, neutralize, type SheetFormat } from '#modules/hr/import/spreadsheet'
import {
  timeLogsIn,
  type ExportCursor,
  type ExportFilters,
  type ExportRow,
} from '#modules/timeclock/repositories/time_log_repository'
import { assertRange } from '#modules/timeclock/services/attendance_service'
import { localDay } from '#modules/timeclock/attendance_rules'
import { TimeLogsExportMail } from '#modules/timeclock/mails/time_logs_export_mail'

/** Bounds of the punch export (lot 2 decision of 2026-11-20). */
export const MAX_EXPORT_DAYS = 366
/** `maxRows` stays under the 1,048,576 rows of an Excel sheet; `pageSize` rows per read. */
export const EXPORT_LIMITS = { maxRows: 1_000_000, pageSize: 2000 }
/** 5 exports per hour and user (08 §9). */
const EXPORTS_PER_HOUR = 5
/** The e-mailed link stays valid 24 hours (08 §9). */
const LINK_TTL_SECONDS = 24 * 3600

const MIME: Record<SheetFormat, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

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

export interface TimeLogExportJob {
  exportId: string
  organizationId: string
  userId: string
  format: SheetFormat
  filters: ExportFilters
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

/** Line by line writer to a file on disk, CSV or XLSX. */
interface SheetWriter {
  add(row: string[]): Promise<void>
  close(): Promise<void>
}

async function csvWriter(path: string): Promise<SheetWriter> {
  const stream = createWriteStream(path, { encoding: 'utf8' })
  const write = async (text: string) => {
    if (!stream.write(text)) await once(stream, 'drain')
  }
  await write(CSV_BOM)
  return {
    add: (row) => write(`${csvLine(row)}\r\n`),
    close: async () => {
      stream.end()
      await once(stream, 'finish')
    },
  }
}

function xlsxWriter(path: string): SheetWriter {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: path })
  const sheet = workbook.addWorksheet('Pointages')
  let header = true
  return {
    add: async (row) => {
      const line = sheet.addRow(row.map(neutralize))
      if (header) line.font = { bold: true }
      header = false
      line.commit()
    },
    close: async () => {
      sheet.commit()
      await workbook.commit()
    },
  }
}

/**
 * Asynchronous punch export (06 §6, 08 §9): the request is checked and
 * answered `202` with a job id; the worker writes the file page by page to
 * disk, stores it in `private-docs` and e-mails a link valid 24 hours. At most
 * 366 local days and 1,000,000 punches; owner and hr_admin only; audited.
 */
export class TimeLogExportService {
  async request(
    tenant: TenantContext,
    actor: User,
    query: TimeLogExportQuery,
    audit: AuditContext
  ) {
    const { organizationId } = tenant
    const { filter } = query
    const job: TimeLogExportJob = {
      exportId: newId(),
      organizationId,
      userId: actor.id,
      format: query.format,
      filters: {
        from: filter.from.toISO()!,
        to: filter.to.toISO()!,
        employeeId: filter.employeeId,
        source: filter.source,
        anomaly: filter.anomaly,
      },
    }
    await withTenant(organizationId, async (trx) => {
      const organization = await organizations.findActive(organizationId, trx)
      if (!organization) throw new AppException('E_NOT_FOUND')
      assertRange(
        localDay(filter.from, organization.timezone),
        localDay(filter.to, organization.timezone),
        MAX_EXPORT_DAYS,
        'validation.timeclock.exportRange'
      )
      const total = await timeLogsIn(organizationId, trx).exportCount(job.filters)
      if (total > EXPORT_LIMITS.maxRows) {
        throw AppException.validation(
          'filter',
          'tooManyRows',
          'validation.timeclock.exportTooLarge'
        )
      }
      // After the checks, so a refused export does not consume the budget.
      await limiter
        .use({ requests: EXPORTS_PER_HOUR, duration: '1 hour' })
        .consume(`time-logs-export:${actor.id}`)
      await auditService.record(
        trx,
        { ...audit, organizationId, actorRole: tenant.primaryRole },
        {
          action: 'time_log.exported',
          targetType: 'organization',
          targetId: organizationId,
          after: { exportId: job.exportId, format: job.format, filters: job.filters, rows: total },
        }
      )
    })
    try {
      await queueService.dispatch('time-logs.export', job)
    } catch (cause) {
      throw new AppException('E_DEPENDENCY_UNAVAILABLE', { cause })
    }
    return { jobId: job.exportId }
  }

  /** Worker side: writes, stores and announces the file. Returns the number of punches. */
  async build(job: TimeLogExportJob) {
    const user = await users.findById(job.userId)
    if (!user) return 0
    const organization = await withTenant(job.organizationId, (trx) =>
      organizations.findActive(job.organizationId, trx)
    )
    if (!organization) return 0
    const locale: Locale = user.preferredLanguage === 'en' ? 'en' : 'fr'

    const directory = await mkdtemp(join(tmpdir(), 'konkoure-export-'))
    const path = join(directory, `export.${job.format}`)
    try {
      const writer = job.format === 'csv' ? await csvWriter(path) : xlsxWriter(path)
      let rows = 0
      try {
        await writer.add(COLUMNS.map((column) => column[locale]))
        let after: ExportCursor | null = null
        const { pageSize } = EXPORT_LIMITS
        for (;;) {
          // One short transaction per page: the export never holds a connection for long.
          const page: ExportRow[] = await withTenant(job.organizationId, (trx) =>
            timeLogsIn(job.organizationId, trx).exportPage(job.filters, after, pageSize)
          )
          for (const row of page) await writer.add(this.line(row, organization.timezone, locale))
          rows += page.length
          if (page.length < pageSize) break
          const last = page[page.length - 1]
          after = { punchedAt: last.punchedAt, id: last.id }
        }
      } finally {
        await writer.close()
      }

      const key = fileStorage.key(job.organizationId, 'export', job.userId, job.format)
      const stored = await fileStorage.putFile('private', key, path, { mime: MIME[job.format] })
      await withTenant(job.organizationId, (trx) =>
        filesIn(job.organizationId, trx).create({
          ...stored,
          ownerType: 'time_log_export',
          ownerId: job.userId,
          uploadedBy: job.userId,
        })
      )
      const { url } = await fileStorage.signedUrl(key, LINK_TTL_SECONDS)
      await dispatchMail(new TimeLogsExportMail(user, { url, rows }))
      return rows
    } finally {
      await rm(directory, { recursive: true, force: true })
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
