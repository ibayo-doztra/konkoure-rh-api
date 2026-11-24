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
