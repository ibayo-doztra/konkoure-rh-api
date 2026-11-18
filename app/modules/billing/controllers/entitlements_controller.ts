import type { HttpContext } from '@adonisjs/core/http'
import { ApiOperation } from '@foadonis/openapi/decorators'
import { AppException } from '#shared/exceptions/app_exception'
import entitlementService from '#modules/billing/services/entitlement_service'
import { entitlementsDto } from '#modules/billing/transformers/entitlement_transformer'

/** `GET /api/v1/org/entitlements` (06-api-reference §3), open to every member. */
export default class EntitlementsController {
  @ApiOperation({ summary: 'Effective modules and quotas of the organization' })
  async show(ctx: HttpContext) {
    const entitlements = await entitlementService.resolve(ctx.tenant.organizationId)
    if (!entitlements) throw new AppException('E_SUBSCRIPTION_INACTIVE')
    return ctx.serialize(entitlementsDto(entitlements))
  }
}
