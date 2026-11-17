import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { AppException } from '#shared/exceptions/app_exception'
import { TenantContext } from '#shared/tenant/tenant_context'
import memberships from '#modules/users/repositories/membership_repository'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * First tenant barrier (docs/backend/01 §4, 05 §1), after `auth`: resolves
 * `X-Organization-Id` against the user's roles and exposes `ctx.tenant`.
 * The server never picks the organization: the header is mandatory.
 */
export default class TenantMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail()

    const organizationId = ctx.request.header('x-organization-id')?.trim()
    if (!organizationId || !UUID.test(organizationId)) {
      throw new AppException('E_BAD_REQUEST', {
        details: [
          {
            field: 'X-Organization-Id',
            rule: 'required',
            message: 'validation.organizationHeader.required',
          },
        ],
      })
    }

    // 04 §3: every /org route stays closed until the e-mail is verified.
    if (!user.emailVerifiedAt) throw new AppException('E_EMAIL_NOT_VERIFIED')

    const roles = await memberships.rolesIn(user.id, organizationId)
    if (roles.length === 0) throw new AppException('E_FORBIDDEN')

    ctx.tenant = new TenantContext(organizationId, roles)
    return next()
  }
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    tenant: TenantContext
  }
}
