import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors as vineErrors } from '@vinejs/vine'
import { errors as authErrors } from '@adonisjs/auth'
import { errors as limiterErrors } from '@adonisjs/limiter'
import { errors as coreErrors } from '@adonisjs/core'
import { errors as lucidErrors } from '@adonisjs/lucid'
import {
  AppException,
  ERROR_STATUS,
  type ErrorCode,
  type ErrorDetail,
} from '#shared/exceptions/app_exception'

interface Rendered {
  code: ErrorCode
  details: ErrorDetail[]
  retryAfter?: number
}

/**
 * Renders every error as `{ error: { code, message, requestId, details } }`
 * (docs/backend/01 §6). Never exposes a stack trace, even in development:
 * unexpected errors are logged with their request id by `report()`.
 */
export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = false

  /** Expected client errors are not reported as application failures. */
  protected ignoreCodes = [
    'E_VALIDATION_ERROR',
    'E_UNAUTHORIZED_ACCESS',
    'E_TOO_MANY_REQUESTS',
    'E_ROUTE_NOT_FOUND',
    'E_ROW_NOT_FOUND',
  ]

  async handle(error: unknown, ctx: HttpContext) {
    const rendered = this.normalize(error)
    if (rendered.retryAfter !== undefined) {
      ctx.response.header('Retry-After', String(rendered.retryAfter))
    }
    const translate = (key: string) => (ctx.i18n ? ctx.i18n.t(key) : key)
    return ctx.response.status(ERROR_STATUS[rendered.code]).send({
      error: {
        code: rendered.code,
        message: translate(`errors.${rendered.code}`),
        requestId: ctx.requestId ?? null,
        // Business validation details carry an i18n key (`validation.*`).
        details: rendered.details.map((detail) => ({
          ...detail,
          message: detail.message.startsWith('validation.')
            ? translate(detail.message)
            : detail.message,
        })),
      },
    })
  }

  async report(error: unknown, ctx: HttpContext) {
    if (error instanceof AppException && ERROR_STATUS[error.errorCode] < 500) return
    return super.report(error, ctx)
  }

  private normalize(error: unknown): Rendered {
    if (error instanceof AppException) {
      return { code: error.errorCode, details: error.details, retryAfter: error.retryAfter }
    }
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      const messages = error.messages as Array<{ field: string; rule: string; message: string }>
      return {
        code: 'E_VALIDATION',
        details: messages.map(({ field, rule, message }) => ({ field, rule, message })),
      }
    }
    if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS) {
      return { code: 'E_UNAUTHORIZED', details: [] }
    }
    if (error instanceof limiterErrors.E_TOO_MANY_REQUESTS) {
      return { code: 'E_RATE_LIMITED', details: [], retryAfter: error.response.availableIn }
    }
    if (
      error instanceof coreErrors.E_ROUTE_NOT_FOUND ||
      error instanceof lucidErrors.E_ROW_NOT_FOUND
    ) {
      return { code: 'E_NOT_FOUND', details: [] }
    }
    const status = (error as { status?: number } | null)?.status
    if (status === 413) return { code: 'E_PAYLOAD_TOO_LARGE', details: [] }
    if (status === 400) return { code: 'E_BAD_REQUEST', details: [] }
    return { code: 'E_INTERNAL', details: [] }
  }
}
