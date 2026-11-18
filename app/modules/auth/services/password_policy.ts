import { readFileSync } from 'node:fs'
import app from '@adonisjs/core/services/app'
import { AppException } from '#shared/exceptions/app_exception'

/**
 * Password strength rules of docs/backend/04 §2, beyond the 10–128 length the
 * validators enforce: one lowercase, one uppercase, one digit; not one of the
 * 10 000 most common passwords; no e-mail or name inside.
 */
let commonPasswords: Set<string> | null = null

function common(): Set<string> {
  if (!commonPasswords) {
    const raw = readFileSync(app.makePath('resources/security/common_passwords.txt'), 'utf8')
    commonPasswords = new Set(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter(Boolean)
    )
  }
  return commonPasswords
}

/** Lower-cases and strips diacritics, so « Aïssatou » matches « aissatou ». */
function fold(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function assertStrongPassword(
  password: string,
  identity: { email: string; fullName?: string | null },
  field = 'password'
) {
  const fail = (rule: string) => {
    throw AppException.validation(field, rule, `validation.password.${rule}`)
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    fail('composition')
  }

  if (common().has(password.toLowerCase())) fail('common')

  const lowered = fold(password)
  const email = fold(identity.email)
  const [localPart] = email.split('@')
  const personal = [email, localPart ?? '']
    .concat(fold(identity.fullName ?? '').split(/[\s.\-_']+/))
    .filter((part) => part.length >= 3)
  if (personal.some((part) => lowered.includes(part))) fail('personal')
}
