import { DateTime } from 'luxon'
import { AppException } from '#shared/exceptions/app_exception'

/** Position in a list sorted by `created_at desc, id desc` (docs/backend/01 §7). */
export interface Cursor {
  createdAt: string
  id: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Opaque cursor: base64url of `{ createdAt, id }`. */
export function encodeCursor(createdAt: DateTime, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toUTC().toISO(), id })).toString(
    'base64url'
  )
}

/** A cursor the API did not issue is a validation error, never a 500. */
export function decodeCursor(value: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<Cursor>
    if (
      typeof parsed.createdAt === 'string' &&
      DateTime.fromISO(parsed.createdAt).isValid &&
      typeof parsed.id === 'string' &&
      UUID.test(parsed.id)
    ) {
      return { createdAt: parsed.createdAt, id: parsed.id }
    }
  } catch {
    // Falls through to the validation error.
  }
  throw AppException.validation('cursor', 'cursor', 'validation.pagination.cursor')
}
