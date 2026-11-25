import type { HttpContext } from '@adonisjs/core/http'
import { ApiBody, ApiOperation } from '@foadonis/openapi/decorators'
import presignupService, { maskEmail } from '#modules/billing/services/presignup_service'
import billingService from '#modules/billing/services/billing_service'
import { planDto } from '#modules/billing/transformers/billing_transformer'
import {
  claimValidator,
  presignupCheckoutValidator,
  presignupReferenceValidator,
} from '#modules/billing/validators/billing_validator'
import { organizationDto } from '#modules/users/transformers/me_transformer'
import { auditContext } from '#modules/auth/http_helpers'
import { AppException } from '#shared/exceptions/app_exception'
import BillingPolicy from '#policies/billing_policy'
import type { AppRole } from '#models/user_role'

/** `/api/v1/public/payments` (06 §11, 07 §7.7, decisions of 2026-11-24). */
export default class PublicPaymentsController {
  /** `GET /public/plans` (06 §11): same shape as `GET /org/billing/plans`. */
  @ApiOperation({ summary: 'Public plan catalogue' })
  async plans(_ctx: HttpContext) {
    const plans = await billingService.plans()
    return { data: plans.map(planDto) }
  }

  @ApiOperation({ summary: 'Pay before sign-up (claim code returned once)' })
  @ApiBody({ type: () => presignupCheckoutValidator })
  async checkout(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(presignupCheckoutValidator)
    const { payment, claimToken, redirectUrl } = await presignupService.checkout(input)
    ctx.response.status(201)
    return ctx.serialize({
      merchantReference: payment.merchantReference,
      claimToken,
      claimExpiresAt: payment.claimExpiresAt?.toUTC().toISO() ?? null,
      status: payment.status,
      expectedAmount: Number(payment.expectedAmount),
      currency: payment.currency,
      instructions: redirectUrl ? null : ctx.i18n.t('billing.instructions.mobileMoney'),
      redirectUrl,
    })
  }

  @ApiOperation({ summary: 'Status of a payment before sign-up (X-Claim-Token)' })
  async show(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(presignupReferenceValidator)
    const { payment, plan } = await presignupService.status(
      params.ref,
      ctx.request.header('x-claim-token')
    )
    const claimable =
      payment.status === 'succeeded' &&
      payment.organizationId === null &&
      payment.claimExpiresAt !== null &&
      payment.claimExpiresAt.toMillis() > Date.now()
    return ctx.serialize({
      status: payment.status,
      planCode: plan.code,
      cycle: payment.cycle,
      expectedAmount: Number(payment.expectedAmount),
      currency: payment.currency,
      emailMasked: payment.claimEmail ? maskEmail(payment.claimEmail) : null,
      claimable,
    })
  }

  @ApiOperation({
    summary: 'Claim a payment made before sign-up: new organization or one the caller owns',
  })
  @ApiBody({ type: () => claimValidator })
  async claim(ctx: HttpContext) {
    const { params, claimToken, organizationName, organizationId } =
      await ctx.request.validateUsing(claimValidator)
    if ((organizationName === undefined) === (organizationId === undefined)) {
      throw AppException.validation(
        organizationId === undefined ? 'organizationName' : 'organizationId',
        'target',
        'validation.billing.claim.target'
      )
    }
    const user = ctx.auth.getUserOrFail()

    let roles: AppRole[] = ['owner']
    let claimed
    if (organizationId !== undefined) {
      // Owner of the target organization only (04 §5 "billing.*"), 404 outside it.
      ctx.tenant = await presignupService.targetContext(user, organizationId)
      await ctx.bouncer.with(BillingPolicy).authorize('manage')
      roles = [...ctx.tenant.roles]
      claimed = await presignupService.claimInto(
        user,
        params.ref,
        { claimToken, organizationId },
        auditContext(ctx)
      )
    } else {
      claimed = await presignupService.claim(
        user,
        params.ref,
        { claimToken, organizationName: organizationName! },
        auditContext(ctx)
      )
    }
    const { organization, planCode } = claimed
    ctx.response.status(201)
    // Same shape as POST /organizations and the entries of GET /me `organizations`.
    return ctx.serialize(
      organizationDto({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logoUrl: organization.logoUrl,
        defaultLanguage: organization.defaultLanguage,
        defaultCurrency: organization.defaultCurrency,
        performanceModel: organization.performanceModel,
        roles,
        plan: planCode,
      })
    )
  }
}
