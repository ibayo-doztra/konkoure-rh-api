import { Exception } from '@adonisjs/core/exceptions'

/**
 * Canonical error codes (docs/backend/01 §6). The HTTP status is fixed per code.
 */
export const ERROR_STATUS = {
  E_BAD_REQUEST: 400,
  E_UNAUTHORIZED: 401,
  E_TOKEN_EXPIRED: 401,
  E_FORBIDDEN: 403,
  E_EMAIL_NOT_VERIFIED: 403,
  E_MODULE_NOT_INCLUDED: 403,
  E_SUBSCRIPTION_INACTIVE: 403,
  E_QUOTA_EXCEEDED: 403,
  E_NOT_FOUND: 404,
  E_CONFLICT: 409,
  E_PASSWORD_RESET_REQUIRED: 409,
  E_PAYLOAD_TOO_LARGE: 413,
  E_VALIDATION: 422,
  E_HIERARCHY_CYCLE: 422,
  E_ACCOUNT_LOCKED: 423,
  E_RATE_LIMITED: 429,
  E_INTERNAL: 500,
  E_DEPENDENCY_UNAVAILABLE: 503,
} as const

export type ErrorCode = keyof typeof ERROR_STATUS

export interface ErrorDetail {
  field: string
  rule: string
  message: string
}

/**
 * Expected business error. The exception handler renders it as
 * `{ error: { code, message, requestId, details } }`, translating
 * `errors.<code>` with the request locale.
 */
export class AppException extends Exception {
  readonly errorCode: ErrorCode
  readonly details: ErrorDetail[]
  /** Seconds before retrying (429), sent as the `Retry-After` header. */
  readonly retryAfter?: number

  constructor(
    errorCode: ErrorCode,
    options: { details?: ErrorDetail[]; retryAfter?: number; cause?: unknown } = {}
  ) {
    super(errorCode, { status: ERROR_STATUS[errorCode], code: errorCode, cause: options.cause })
    this.errorCode = errorCode
    this.details = options.details ?? []
    this.retryAfter = options.retryAfter
  }

  static validation(field: string, rule: string, message: string) {
    return new AppException('E_VALIDATION', { details: [{ field, rule, message }] })
  }
}
