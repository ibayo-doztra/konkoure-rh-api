import { beforeCreate, column } from '@adonisjs/lucid/orm'
import { JobSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type JobStatus = JobSchema['status']
export type RequiredDocument = JobSchema['requiredDocuments'][number]

/** Job offer (docs/backend/02 §7, 07 §4.1). Never serialized directly. */
export default class Job extends JobSchema {
  static table = 'jobs'
  static selfAssignPrimaryKey = true

  /** The pg driver would write a JS array as a PostgreSQL array, not as jsonb. */
  @column({ prepare: (value: RequiredDocument[]) => JSON.stringify(value) })
  declare requiredDocuments: RequiredDocument[]

  @beforeCreate()
  static assignId(job: Job) {
    job.id ??= newId()
  }
}
