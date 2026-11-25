import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import PlatformSetting from '#models/platform_setting'
import type User from '#models/user'
import { AppException } from '#shared/exceptions/app_exception'
import auditService, { type AuditContext } from '#shared/audit/audit_service'
import { MODULES_OPEN_FOR_TESTING } from '#shared/platform/platform_settings'

/**
 * Known settings and the validation of their value. A key absent from this
 * registry cannot be written through the API.
 */
const REGISTRY: Record<string, { value: ReturnType<typeof vine.create> }> = {
  [MODULES_OPEN_FOR_TESTING]: { value: vine.create({ value: vine.boolean({ strict: true }) }) },
}

const REDACTED = '[redacted]'

/** `/platform/settings` (06 §13): support reads, root writes; secrets never leave. */
export class PlatformSettingsService {
  list() {
    return PlatformSetting.query().orderBy('key', 'asc')
  }

  async update(actor: User, entries: Array<{ key: string; value?: unknown }>, audit: AuditContext) {
    const checked: Array<{ key: string; value: unknown }> = []
    for (const entry of entries) {
      const definition = REGISTRY[entry.key]
      if (!definition) {
        throw AppException.validation('settings', 'unknown', 'validation.platform.unknownSetting')
      }
      const { value } = (await definition.value.validate({ value: entry.value })) as {
        value: unknown
      }
      checked.push({ key: entry.key, value })
    }

    return db.transaction(async (trx) => {
      for (const { key, value } of checked) {
        const setting = await PlatformSetting.query({ client: trx })
          .where('key', key)
          .forUpdate()
          .first()
        if (!setting) throw new AppException('E_NOT_FOUND')
        const before = setting.isSecret ? REDACTED : setting.value
        setting.merge({ value, updatedBy: actor.id })
        await setting.useTransaction(trx).save()
        await auditService.record(
          trx,
          { ...audit, actorUserId: actor.id, actorRole: 'platform_root' },
          {
            action: 'platform_setting.updated',
            targetType: 'platform_setting',
            targetId: null,
            before: { key, value: before },
            after: { key, value: setting.isSecret ? REDACTED : value },
          }
        )
      }
      return PlatformSetting.query({ client: trx }).orderBy('key', 'asc')
    })
  }
}

export default new PlatformSettingsService()
