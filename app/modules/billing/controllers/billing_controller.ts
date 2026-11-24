import type { HttpContext } from '@adonisjs/core/http'
import { ApiOperation } from '@foadonis/openapi/decorators'
import BillingPolicy from '#policies/billing_policy'
import billingService from '#modules/billing/services/billing_service'
import {
  invoiceDto,
  paymentDto,
  planDto,
  subscriptionDto,
} from '#modules/billing/transformers/billing_transformer'
import {
  listInvoicesValidator,
  listPaymentsValidator,
  paymentIdValidator,
} from '#modules/billing/validators/billing_validator'
import { pageMetaDto } from '#modules/hr/transformers/hr_transformer'
import { auditContext } from '#modules/auth/http_helpers'

/**
 * `/api/v1/org/billing` (06 §10), owners only. No entitlement middleware: an
 * expired organization keeps billing to subscribe again (07 §6.2).
 */
export default class BillingController {
  @ApiOperation({ summary: 'Current subscription, trial and term' })
  async subscription(ctx: HttpContext) {
    await ctx.bouncer.with(BillingPolicy).authorize('manage')
    const { subscription, entitlements } = await billingService.subscription(ctx.tenant)
    return ctx.serialize(subscriptionDto(subscription, entitlements))
  }

  @ApiOperation({ summary: 'Public plan catalogue' })
  async plans(ctx: HttpContext) {
    await ctx.bouncer.with(BillingPolicy).authorize('manage')
    const plans = await billingService.plans()
    return { data: plans.map(planDto) }
  }

  @ApiOperation({ summary: 'Usage counters: employees and AI credits of the month' })
  async usage(ctx: HttpContext) {
    await ctx.bouncer.with(BillingPolicy).authorize('manage')
    return ctx.serialize(await billingService.usage(ctx.tenant))
  }

  @ApiOperation({ summary: 'Payment history' })
  async payments(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listPaymentsValidator)
    await ctx.bouncer.with(BillingPolicy).authorize('manage')
    const page = await billingService.payments(ctx.tenant, {
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
      status: query.filter?.status,
    })
    return { data: page.all().map(paymentDto), meta: pageMetaDto(page.getMeta()) }
  }

  @ApiOperation({ summary: 'Status of a payment (polling)' })
  async payment(ctx: HttpContext) {
    const { params } = await ctx.request.validateUsing(paymentIdValidator)
    await ctx.bouncer.with(BillingPolicy).authorize('manage')
    return ctx.serialize(paymentDto(await billingService.payment(ctx.tenant, params.id)))
  }

  @ApiOperation({ summary: 'Invoices' })
  async invoices(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(listInvoicesValidator)
    await ctx.bouncer.with(BillingPolicy).authorize('manage')
    const page = await billingService.invoices(ctx.tenant, {
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
    })
    return { data: page.all().map(invoiceDto), meta: pageMetaDto(page.getMeta()) }
  }

  @ApiOperation({ summary: 'Cancel at the end of the period' })
  async cancel(ctx: HttpContext) {
    await ctx.bouncer.with(BillingPolicy).authorize('manage')
    const { subscription, entitlements } = await billingService.cancel(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      auditContext(ctx)
    )
    return ctx.serialize(subscriptionDto(subscription, entitlements))
  }

  @ApiOperation({ summary: 'Resume a canceled subscription before its term' })
  async resume(ctx: HttpContext) {
    await ctx.bouncer.with(BillingPolicy).authorize('manage')
    const { subscription, entitlements } = await billingService.resume(
      ctx.tenant,
      ctx.auth.getUserOrFail(),
      auditContext(ctx)
    )
    return ctx.serialize(subscriptionDto(subscription, entitlements))
  }
}
