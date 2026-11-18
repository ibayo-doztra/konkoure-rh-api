import { createHash, randomBytes } from 'node:crypto'
import { uuidv7 } from 'uuidv7'

/** Application-generated uuid v7 identifier (docs/backend/00 §4). */
export function newId(): string {
  return uuidv7()
}

/** Opaque random token, URL safe. Only its hash is ever stored. */
export function randomToken(bytes: number, prefix = ''): string {
  return `${prefix}${randomBytes(bytes).toString('base64url')}`
}

/** SHA-256 hex digest used to store and look up opaque tokens. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
