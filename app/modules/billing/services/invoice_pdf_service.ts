import PDFDocument from 'pdfkit'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import Plan from '#models/plan'
import { AppException } from '#shared/exceptions/app_exception'
import { diskFor } from '#shared/files/storage_disks'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import organizations from '#modules/organizations/repositories/organization_repository'
import { invoicesIn, paymentsIn } from '#modules/billing/repositories/payment_repository'

/** Signed links to an invoice live 15 minutes (decision of 2026-11-24). */
const URL_TTL_SECONDS = 15 * 60

interface InvoiceLines {
  number: string
  organizationName: string
  planName: string
  cycle: string
  amount: number
  currency: string
  issuedAt: string
  periodStart: string
  periodEnd: string
}

/** Renders the invoice in French, the language of Konkouré's invoices (pdfkit). */
export function renderInvoicePdf(lines: InvoiceLines): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: lines.number } })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const amount = new Intl.NumberFormat('fr-FR').format(lines.amount)
    doc.fontSize(20).text('Konkouré', { continued: false })
    doc.moveDown(0.5).fontSize(14).text(`Facture ${lines.number}`)
    doc.moveDown().fontSize(11)
    doc.text(`Date d'émission : ${lines.issuedAt}`)
    doc.text(`Client : ${lines.organizationName}`)
    doc.moveDown()
    doc.text(`Offre : ${lines.planName} (${lines.cycle === 'yearly' ? 'annuelle' : 'mensuelle'})`)
    doc.text(`Période : du ${lines.periodStart} au ${lines.periodEnd}`)
    doc.moveDown()
    doc.fontSize(13).text(`Montant payé : ${amount} ${lines.currency}`)
    doc.end()
  })
}

/** Invoice PDF (06 §10): rendered by the `invoices.render` job, served by signed link. */
export class InvoicePdfService {
  /** The `invoices.render` job; idempotent, a rendered invoice is left as is. */
  async render({ organizationId, invoiceId }: { organizationId: string; invoiceId: string }) {
    const lines = await withTenant(organizationId, async (trx) => {
      const invoice = await invoicesIn(organizationId, trx).find(invoiceId)
      if (!invoice || invoice.pdfPath) return null
      const payment = invoice.paymentId
        ? await paymentsIn(organizationId, trx).find(invoice.paymentId)
        : null
      const plan = payment ? await Plan.find(payment.planId, { client: trx }) : null
      const organization = await organizations.findActive(organizationId, trx)
      return {
        number: invoice.number,
        organizationName: organization?.name ?? '',
        planName: plan?.name ?? '',
        cycle: payment?.cycle ?? 'monthly',
        amount: Number(invoice.amount),
        currency: invoice.currency,
        issuedAt: invoice.issuedAt.setZone('Africa/Conakry').toFormat('dd/MM/yyyy'),
        periodStart: invoice.periodStart.setZone('Africa/Conakry').toFormat('dd/MM/yyyy'),
        periodEnd: invoice.periodEnd.setZone('Africa/Conakry').toFormat('dd/MM/yyyy'),
      }
    })
    if (!lines) return 'skipped'

    const path = `invoices/${organizationId}/${lines.number}.pdf`
    await drive.use(diskFor('private')).put(path, await renderInvoicePdf(lines), {
      contentType: 'application/pdf',
    })
    await withTenant(organizationId, async (trx) => {
      const invoices = invoicesIn(organizationId, trx)
      const invoice = await invoices.findForUpdate(invoiceId)
      if (!invoice) return
      invoice.pdfPath = path
      await invoices.save(invoice)
    })
    logger.info({ invoiceId }, 'invoices.rendered')
    return 'rendered'
  }

  /** `GET /org/billing/invoices/:id/pdf`: `409` until the PDF exists. */
  async url(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    const invoice = await withTenant(organizationId, (trx) =>
      invoicesIn(organizationId, trx).findOrFail(id)
    )
    if (!invoice.pdfPath) {
      throw new AppException('E_CONFLICT', {
        details: [{ field: 'pdf', rule: 'notReady', message: 'validation.billing.noPdf' }],
      })
    }
    const url = await drive
      .use(diskFor('private'))
      .getSignedUrl(invoice.pdfPath, { expiresIn: `${URL_TTL_SECONDS}s` })
    return { url, expiresIn: URL_TTL_SECONDS }
  }
}

export default new InvoicePdfService()
