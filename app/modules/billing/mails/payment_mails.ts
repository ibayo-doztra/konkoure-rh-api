import { DateTime } from 'luxon'
import { LocalizedMail } from '#modules/auth/mails/localized_mail'

/** `payment_succeeded` (docs/backend/07 §7.5): confirmation to the owners. */
export class PaymentSucceededMail extends LocalizedMail {
  constructor(
    recipient: LocalizedMail['recipient'],
    private details: { plan: string; amount: string; invoiceNumber: string; periodEnd: string }
  ) {
    super(recipient)
  }

  prepare() {
    const locale = this.recipient.preferredLanguage === 'en' ? 'en' : 'fr'
    const data = {
      plan: this.details.plan,
      amount: new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'fr-FR').format(
        Number(this.details.amount)
      ),
      invoice: this.details.invoiceNumber,
      end: DateTime.fromISO(this.details.periodEnd)
        .setLocale(locale)
        .toLocaleString(DateTime.DATE_MED),
    }
    this.message
      .to(this.recipient.email)
      .subject(this.t('emails.paymentSucceeded.subject', data))
      .html(this.layout([this.greeting(), this.t('emails.paymentSucceeded.body', data)]))
  }
}
