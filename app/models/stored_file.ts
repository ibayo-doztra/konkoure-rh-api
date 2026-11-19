import { beforeCreate, column } from '@adonisjs/lucid/orm'
import { FileSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type FileCategory = NonNullable<FileSchema['category']>

/** Row of the `files` registry (docs/backend/02 §10). Never serialized directly. */
export default class StoredFile extends FileSchema {
  static table = 'files'
  static selfAssignPrimaryKey = true

  /** The naming strategy would map it to `checksum_sha_256`. */
  @column({ columnName: 'checksum_sha256' })
  declare checksumSha256: string

  @beforeCreate()
  static assignId(file: StoredFile) {
    file.id ??= newId()
  }
}
