import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import fileStorage from '#shared/files/file_storage'

/** A file is only an orphan once it has had no owner for 24 hours (08 §6). */
const GRACE_HOURS = 24
const BATCH = 200

/**
 * Table holding the owner of each `files.owner_type`. An owner that is only
 * soft-deleted still exists. A type missing from this map is never touched.
 */
const OWNER_TABLES: Record<string, string> = {
  employee: 'employees',
  employee_photo: 'employees',
  contract: 'contracts',
  candidate: 'candidates',
  leave_attachment: 'leave_requests',
  organization_logo: 'organizations',
  employee_export: 'users',
  time_log_export: 'users',
}

interface OrphanRow {
  id: string
  bucket: string
  path: string
}

/**
 * `files.purge-orphans` (daily, 08 §6): deletes the registry rows older than
 * 24 hours whose owner no longer exists, and their stored object. Only the
 * registry is read, never the bucket listing. A row whose object could not be
 * deleted stays for the next run. Runs as the worker, outside any tenant.
 */
export class OrphanFileService {
  async purge(at: DateTime = DateTime.now()) {
    const before = at.minus({ hours: GRACE_HOURS }).toJSDate()
    const byTable = new Map<string, string[]>()
    for (const [type, table] of Object.entries(OWNER_TABLES)) {
      byTable.set(table, [...(byTable.get(table) ?? []), type])
    }
    const clauses: string[] = []
    const bindings: unknown[] = [before]
    for (const [table, types] of byTable) {
      clauses.push(
        `(f.owner_type = ANY(?::text[]) AND (f.owner_id IS NULL OR NOT EXISTS (
           SELECT 1 FROM ${table} o WHERE o.id = f.owner_id)))`
      )
      bindings.push(types)
    }

    let removed = 0
    let kept = 0
    let after = '00000000-0000-0000-0000-000000000000'
    for (;;) {
      const result = await db.rawQuery<{ rows: OrphanRow[] }>(
        `SELECT f.id, f.bucket, f.path FROM files f
          WHERE f.created_at < ? AND (${clauses.join(' OR ')}) AND f.id > ?::uuid
          ORDER BY f.id LIMIT ?`,
        [...bindings, after, BATCH]
      )
      const rows = result.rows
      if (rows.length === 0) break
      after = rows[rows.length - 1].id

      const deleted: string[] = []
      for (const row of rows) {
        const space = fileStorage.spaceOf(row.bucket)
        if (space && (await fileStorage.remove(space, row.path))) deleted.push(row.id)
        else kept++
      }
      if (deleted.length > 0) {
        await db.rawQuery('DELETE FROM files WHERE id = ANY(?::uuid[])', [deleted])
        removed += deleted.length
      }
      if (rows.length < BATCH) break
    }
    logger.info({ removed, kept }, 'files.purge_orphans_done')
    return removed
  }
}

export default new OrphanFileService()
