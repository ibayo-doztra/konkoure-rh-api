import app from '@adonisjs/core/services/app'
import { defineConfig, services } from '@adonisjs/drive'
import type { InferDriveDisks } from '@adonisjs/drive/types'
import env from '#start/env'

/**
 * File storage (docs/backend/00 §3, 11 §1): S3-compatible buckets, private by
 * default. The local disk serves nothing over HTTP; tests use `drive.fake()`.
 */
const s3 = {
  credentials: {
    accessKeyId: env.get('S3_ACCESS_KEY_ID', ''),
    secretAccessKey: env.get('S3_SECRET_ACCESS_KEY')?.release() ?? '',
  },
  region: env.get('S3_REGION', 'auto'),
  endpoint: env.get('S3_ENDPOINT'),
  forcePathStyle: true,
}

const driveConfig = defineConfig({
  default: env.get('DRIVE_DISK', 'fs'),

  services: {
    fs: services.fs({
      location: app.makePath('storage'),
      serveFiles: false,
      visibility: 'private',
    }),
    s3: services.s3({ ...s3, bucket: env.get('S3_BUCKET_PRIVATE', ''), visibility: 'private' }),
    s3Public: services.s3({
      ...s3,
      bucket: env.get('S3_BUCKET_PUBLIC', ''),
      visibility: 'public',
      cdnUrl: env.get('S3_PUBLIC_BASE_URL'),
    }),
  },
})

export default driveConfig

declare module '@adonisjs/drive/types' {
  export interface DriveDisks extends InferDriveDisks<typeof driveConfig> {}
}
