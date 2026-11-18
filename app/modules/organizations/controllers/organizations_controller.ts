import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import organizationService, {
  TRIAL_PLAN_CODE,
} from '#modules/organizations/services/organization_service'
import { createOrganizationValidator } from '#modules/organizations/validators/organization_validator'
import { organizationDto } from '#modules/users/transformers/me_transformer'
import { auditContext } from '#modules/auth/http_helpers'

/** `POST /api/v1/organizations` (06-api-reference §3). */
export default class OrganizationsController {
  @ApiOperation({ summary: 'Create an organization (creator becomes owner)' })
  @ApiBody({ type: () => createOrganizationValidator })
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createOrganizationValidator)
    const organization = await organizationService.create(
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    ctx.response.status(201)
    // Same shape as the entries of GET /me `organizations`.
    return ctx.serialize(
      organizationDto({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logoUrl: organization.logoUrl,
        defaultLanguage: organization.defaultLanguage,
        defaultCurrency: organization.defaultCurrency,
        performanceModel: organization.performanceModel,
        roles: ['owner'],
        plan: TRIAL_PLAN_CODE,
      })
    )
  }
}
