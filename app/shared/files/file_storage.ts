import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import logger from '@adonisjs/core/services/logger'
import drive from '@adonisjs/drive/services/main'
import { AppException } from '#shared/exceptions/app_exception'
import { newId } from '#shared/utils/crypto'

import { diskFor, type Space } from '#shared/files/storage_disks'

export type { Space }

/** Disks and bucket names of docs/backend/08 §6 (local disk outside production, see storage_disks). */
const SPACES = {
  private: { disk: diskFor('private'), bucket: 'private-docs' },
  public: { disk: diskFor('public'), bucket: 'public-assets' },
} as const

/** Signed links to private documents last 15 minutes (08 §6). */
export const SIGNED_URL_TTL_SECONDS = 15 * 60

export interface CheckedUpload<Type extends { mime: string; extension: string }> {
  content: Buffer
  type: Type
}

/**
 * Storage of uploaded files (08 §6): real type checked by signature, key
 * generated server-side (`<orgId>/<domain>/<ownerId>/<uuidv7>.<ext>`), SHA-256
 * kept for the `files` registry. Storage calls never run inside a transaction.
 */
export class FileStorage {
  /** Size, then real type; the announced name and Content-Type are ignored (05 §3). */
  async check<Type extends { mime: string; extension: string }>(
    file: MultipartFile,
    maxBytes: number,
    detect: (content: Buffer) => Type | null,
    onInvalid: () => AppException
  ): Promise<CheckedUpload<Type>> {
    if (file.size > maxBytes) throw new AppException('E_PAYLOAD_TOO_LARGE')
    if (!file.tmpPath) throw new AppException('E_BAD_REQUEST')
    const content = await readFile(file.tmpPath)
    const type = detect(content)
    if (!type) throw onInvalid()
    return { content, type }
  }

  key(organizationId: string, domain: string, ownerId: string, extension: string) {
    return `${organizationId}/${domain}/${ownerId}/${newId()}.${extension}`
  }

  /** Writes the object and returns the attributes of its `files` row. */
  async put(space: Space, key: string, upload: CheckedUpload<{ mime: string; extension: string }>) {
    const { disk, bucket } = SPACES[space]
    try {
      await drive.use(disk).put(key, upload.content, {
        contentType: upload.type.mime,
        visibility: space,
      })
    } catch (cause) {
      throw new AppException('E_DEPENDENCY_UNAVAILABLE', { cause })
    }
    return {
      bucket,
      path: key,
      mime: upload.type.mime,
      sizeBytes: upload.content.length,
      checksumSha256: createHash('sha256').update(upload.content).digest('hex'),
      visibility: space,
    }
  }

  /**
   * Writes a generated file from disk in a stream (large exports), so it is
   * never held in memory; returns the attributes of its `files` row.
   */
  async putFile(space: Space, key: string, path: string, type: { mime: string }) {
    const { disk, bucket } = SPACES[space]
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer)
    const { size } = await stat(path)
    try {
      await drive.use(disk).putStream(key, createReadStream(path), {
        contentType: type.mime,
        visibility: space,
      })
    } catch (cause) {
      throw new AppException('E_DEPENDENCY_UNAVAILABLE', { cause })
    }
    return {
      bucket,
      path: key,
      mime: type.mime,
      sizeBytes: size,
      checksumSha256: hash.digest('hex'),
      visibility: space,
    }
  }

  async publicUrl(key: string) {
    try {
      return await drive.use(SPACES.public.disk).getUrl(key)
    } catch (cause) {
      throw new AppException('E_DEPENDENCY_UNAVAILABLE', { cause })
    }
  }

  async signedUrl(key: string, ttlSeconds = SIGNED_URL_TTL_SECONDS) {
    try {
      const url = await drive
        .use(SPACES.private.disk)
        .getSignedUrl(key, { expiresIn: `${ttlSeconds}s` })
      return { url, expiresIn: ttlSeconds }
    } catch (cause) {
      throw new AppException('E_DEPENDENCY_UNAVAILABLE', { cause })
    }
  }

  /** Space of a `files.bucket` value, or null for an unknown bucket. */
  spaceOf(bucket: string): Space | null {
    if (bucket === SPACES.private.bucket) return 'private'
    if (bucket === SPACES.public.bucket) return 'public'
    return null
  }

  /** Deletes the object and tells whether it worked, for callers that retry later. */
  async remove(space: Space, key: string) {
    try {
      await drive.use(SPACES[space].disk).delete(key)
      return true
    } catch (error) {
      logger.warn({ err: error, key }, 'file.delete_failed')
      return false
    }
  }

  /** Best effort: an orphan left behind is swept by the maintenance job (08 §6). */
  async deleteQuietly(space: Space, key: string) {
    try {
      await drive.use(SPACES[space].disk).delete(key)
    } catch (error) {
      logger.warn({ err: error, key }, 'file.delete_failed')
    }
  }
}

export default new FileStorage()
