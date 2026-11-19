import { DateTime } from 'luxon'
import { LocalizedMail } from '#modules/auth/mails/localized_mail'
import type { LeaveType } from '#models/leave_request'

export interface LeaveMailDetails {
  employeeName: string
  type: LeaveType
  startDate: string
  endDate: string
  requestedDays: number
}

abstract class LeaveMail extends LocalizedMail {
  protected locale() {
    return this.recipient.preferredLanguage === 'en' ? 'en' : 'fr'
  }

  protected date(iso: string) {
    return DateTime.fromISO(iso).setLocale(this.locale()).toLocaleString(DateTime.DATE_MED)
  }

  protected number(value: number) {
    return new Intl.NumberFormat(this.locale()).format(value)
  }

  protected common(details: LeaveMailDetails) {
    return {
      employee: details.employeeName,
      type: this.t(`emails.leaveTypes.${details.type}`),
      start: this.date(details.startDate),
      end: this.date(details.endDate),
      days: this.number(details.requestedDays),
    }
  }
}

/** `leave_requested` (docs/backend/08 §4): to the approver. */
export class LeaveRequestedMail extends LeaveMail {
  constructor(
    recipient: LocalizedMail['recipient'],
    private details: LeaveMailDetails & { balanceAfter: number | null }
  ) {
    super(recipient)
  }

  prepare() {
    const data = this.common(this.details)
    const paragraphs = [this.greeting(), this.t('emails.leaveRequested.body', data)]
    if (this.details.balanceAfter !== null) {
      paragraphs.push(
        this.t('emails.leaveRequested.balance', {
          balance: this.number(this.details.balanceAfter),
        })
      )
    }
    this.message
      .to(this.recipient.email)
      .subject(this.t('emails.leaveRequested.subject', data))
      .html(this.layout(paragraphs))
  }
}

/** `leave_decided` (08 §4): to the employee, with the reason of a rejection. */
export class LeaveDecidedMail extends LeaveMail {
  constructor(
    recipient: LocalizedMail['recipient'],
    private details: LeaveMailDetails & {
      decision: 'approved' | 'rejected'
      comment: string | null
    }
  ) {
    super(recipient)
  }

  prepare() {
    const data = this.common(this.details)
    const key = `emails.leaveDecided.${this.details.decision}`
    const paragraphs = [this.greeting(), this.t(`${key}.body`, data)]
    if (this.details.comment) {
      paragraphs.push(this.t('emails.leaveDecided.comment', { comment: this.details.comment }))
    }
    this.message
      .to(this.recipient.email)
      .subject(this.t(`${key}.subject`, data))
      .html(this.layout(paragraphs))
  }
}
