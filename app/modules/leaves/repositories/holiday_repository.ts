import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import PublicHoliday from '#models/public_holiday'
import { TenantRepository } from '#shared/base/tenant_repository'
import { recurringOn } from '#modules/leaves/leave_rules'

/** Tenant-scoped public holidays (docs/backend/02 §6, 07 §9). */
export class HolidayRepository extends TenantRepository<typeof PublicHoliday> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(PublicHoliday, organizationId, trx)
  }

  create(data: Partial<ModelAttributes<PublicHoliday>>) {
    return PublicHoliday.create(
      { ...data, organizationId: this.organizationId },
      { client: this.trx }
    )
  }

  /** Holidays dated in `year`, in calendar order. */
  ofYear(year: number) {
    return this.query()
      .whereBetween('date', [`${year}-01-01`, `${year}-12-31`])
      .orderBy('date', 'asc')
  }

  async dateTaken(date: string, exceptId?: string) {
    const query = this.query().where('date', date)
    if (exceptId) query.whereNot('id', exceptId)
    return (await query.first()) !== null
  }

  /**
   * Holidays falling in `[startDate, endDate]`, with the ISO date they fall on:
   * dated ones, plus recurring ones moved to each year of the range.
   */
  async occurrences(startDate: string, endDate: string) {
    const rows = await this.query()
      .where((query) => {
        query.whereBetween('date', [startDate, endDate]).orWhere('is_recurring', true)
      })
      .orderBy('date', 'asc')
    const firstYear = Number(startDate.slice(0, 4))
    const lastYear = Number(endDate.slice(0, 4))
    const found: Array<{ holiday: PublicHoliday; date: string }> = []
    const seen = new Set<string>()
    for (const holiday of rows) {
      const dates = holiday.isRecurring
        ? Array.from({ length: lastYear - firstYear + 1 }, (_, index) =>
            recurringOn(holiday.date, firstYear + index)
          )
        : [holiday.date.toISODate()]
      for (const date of dates) {
        if (!date || date < startDate || date > endDate || seen.has(date)) continue
        seen.add(date)
        found.push({ holiday, date })
      }
    }
    return found.sort((a, b) => a.date.localeCompare(b.date))
  }

  /** ISO dates off in `[startDate, endDate]`. */
  async datesWithin(startDate: string, endDate: string): Promise<Set<string>> {
    const found = await this.occurrences(startDate, endDate)
    return new Set(found.map((occurrence) => occurrence.date))
  }

  async remove(holiday: PublicHoliday) {
    holiday.useTransaction(this.trx)
    await holiday.delete()
  }
}

export function holidaysIn(organizationId: string, trx: TransactionClientContract) {
  return new HolidayRepository(organizationId, trx)
}
