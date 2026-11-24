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
