import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import OrganizationPolicy from '#policies/organization_policy'
import organizationService from '#modules/organizations/services/organization_service'
import organizationLogoService from '#modules/organizations/services/organization_logo_service'
import { organizationDetailDto } from '#modules/organizations/transformers/organization_transformer'
import {
  deleteOrganizationValidator,
  organizationLogoValidator,
  updateOrganizationSettingsValidator,
  updateOrganizationValidator,
} from '#modules/organizations/validators/organization_validator'
import { auditContext } from '#modules/auth/http_helpers'

/** `/api/v1/org`: the organization of `X-Organization-Id` (06-api-reference §3). */
export default class CurrentOrganizationController {
  @ApiOperation({ summary: 'Current organization' })
  async show(ctx: HttpContext) {
    const organization = await organizationService.current(ctx.tenant)
    return ctx.serialize(organizationDetailDto(organization))
  }

  @ApiOperation({ summary: 'Update name, language, currency, time zone or performance model' })
  @ApiBody({ type: () => updateOrganizationValidator })
  async update(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(updateOrganizationValidator)
    await ctx.bouncer.with(OrganizationPolicy).authorize('update')
    const organization = await organizationService.update(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      input,
      auditContext(ctx)
    )
    return ctx.serialize(organizationDetailDto(organization))
  }

  @ApiOperation({ summary: 'Replace the settings block' })
  @ApiBody({ type: () => updateOrganizationSettingsValidator })
  async updateSettings(ctx: HttpContext) {
    const settings = await ctx.request.validateUsing(updateOrganizationSettingsValidator)
    await ctx.bouncer.with(OrganizationPolicy).authorize('update')
    const organization = await organizationService.updateSettings(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      settings,
      auditContext(ctx)
    )
    return ctx.serialize(organizationDetailDto(organization))
  }

  @ApiOperation({ summary: 'Upload the logo (multipart field `logo`, PNG/JPEG/WebP, 2 MB)' })
  async uploadLogo(ctx: HttpContext) {
    const { logo } = await ctx.request.validateUsing(organizationLogoValidator)
    await ctx.bouncer.with(OrganizationPolicy).authorize('update')
    const organization = await organizationLogoService.replace(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      logo,
      auditContext(ctx)
    )
    return ctx.serialize(organizationDetailDto(organization))
  }

  @ApiOperation({ summary: 'Delete the organization (confirmed by its exact name)' })
  @ApiBody({ type: () => deleteOrganizationValidator })
  async destroy(ctx: HttpContext) {
    const { confirmName } = await ctx.request.validateUsing(deleteOrganizationValidator)
    await ctx.bouncer.with(OrganizationPolicy).authorize('delete')
    await organizationService.remove(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      confirmName,
      auditContext(ctx)
    )
    return ctx.response.noContent()
  }
}
