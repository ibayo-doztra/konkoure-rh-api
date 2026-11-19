import { DateTime } from 'luxon'
import { LocalizedMail } from '#modules/auth/mails/localized_mail'

/** `contract_expiring` (docs/backend/08 §4): to HR, before the end of a contract. */
export class ContractExpiringMail extends LocalizedMail {
  constructor(
    recipient: LocalizedMail['recipient'],
    private details: { employeeName: string; endDate: string }
  ) {
    super(recipient)
  }

  prepare() {
    const locale = this.recipient.preferredLanguage === 'en' ? 'en' : 'fr'
    const data = {
      employee: this.details.employeeName,
      end: DateTime.fromISO(this.details.endDate)
        .setLocale(locale)
        .toLocaleString(DateTime.DATE_MED),
    }
    this.message
      .to(this.recipient.email)
      .subject(this.t('emails.contractExpiring.subject', data))
      .html(this.layout([this.greeting(), this.t('emails.contractExpiring.body', data)]))
  }
}
