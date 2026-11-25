import vine from '@vinejs/vine'

const PAYMENT_STATUSES = [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'expired',
  'refunded',
] as const

const paging = {
  page: vine.number().withoutDecimals().min(1).max(10_000).optional(),
  perPage: vine.number().withoutDecimals().min(1).max(100).optional(),
}

export const listPaymentsValidator = vine.create({
  ...paging,
  filter: vine.object({ status: vine.enum(PAYMENT_STATUSES).optional() }).optional(),
})

export const listInvoicesValidator = vine.create({ ...paging })

export const paymentIdValidator = vine.create({
  params: vine.object({ id: vine.string().uuid() }),
})

/** POST /org/billing/checkout (06 §10); the amount never comes from the client (07 §7.1). */
export const checkoutValidator = vine.create({
  planId: vine.string().uuid(),
  cycle: vine.enum(['monthly', 'yearly'] as const),
  method: vine.enum(['orange_money', 'mtn_momo', 'card'] as const),
  payerPhone: vine
    .string()
    .trim()
    .regex(/^\+?224\d{8,9}$/)
    .optional(),
})

export const invoiceIdValidator = vine.create({
  params: vine.object({ id: vine.string().uuid() }),
})

const reference = () => vine.object({ ref: vine.string().uuid() })

/** POST /public/payments/checkout (decision of 2026-11-24): e-mail bound to the claim. */
export const presignupCheckoutValidator = vine.create({
  planId: vine.string().uuid(),
  cycle: vine.enum(['monthly', 'yearly'] as const),
  method: vine.enum(['orange_money', 'mtn_momo', 'card'] as const),
  payerPhone: vine
    .string()
    .trim()
    .regex(/^\+?224\d{8,9}$/)
    .optional(),
  email: vine.string().trim().email().maxLength(254),
})

export const presignupReferenceValidator = vine.create({ params: reference() })

/**
 * POST /public/payments/:ref/claim (06 §11): exactly one of `organizationName`
 * (creates an organization) and `organizationId` (an organization the caller
 * owns, decision of 2026-11-25); the controller enforces the exclusivity.
 */
export const claimValidator = vine.create({
  params: reference(),
  claimToken: vine.string().trim().minLength(10).maxLength(200),
  organizationName: vine.string().trim().minLength(2).maxLength(120).optional(),
  organizationId: vine.string().uuid().optional(),
})
