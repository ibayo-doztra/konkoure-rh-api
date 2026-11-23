import app from '@adonisjs/core/services/app'
import env from '#start/env'

export type Space = 'private' | 'public'

/**
 * Where uploaded files go (08 §6): the S3 buckets, or, outside production
 * only, the local `fs` disk (`FILE_STORAGE_DISK=fs`) for environments without
 * S3 such as the front's end-to-end suite. Both spaces then share the disk.
 */
export const fileStorageMode = env.get('FILE_STORAGE_DISK', 's3')

if (fileStorageMode === 'fs' && app.inProduction) {
  throw new Error('FILE_STORAGE_DISK=fs is for development and test environments only')
}

export function diskFor(space: Space): 's3' | 's3Public' | 'fs' {
  if (fileStorageMode === 'fs') return 'fs'
  return space === 'private' ? 's3' : 's3Public'
}
