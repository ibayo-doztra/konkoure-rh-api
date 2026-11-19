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
   * ISO dates off in `[startDate, endDate]` (same year): dated holidays, plus
   * recurring ones moved to that year.
   */
  async datesWithin(startDate: string, endDate: string, year: number): Promise<Set<string>> {
    const rows = await this.query()
      .where((query) => {
        query.whereBetween('date', [startDate, endDate]).orWhere('is_recurring', true)
      })
      .select('date', 'is_recurring')
    const dates = new Set<string>()
    for (const row of rows) {
      const date = row.isRecurring ? recurringOn(row.date, year) : row.date.toISODate()
      if (date && date >= startDate && date <= endDate) dates.add(date)
    }
    return dates
  }

  async remove(holiday: PublicHoliday) {
    holiday.useTransaction(this.trx)
    await holiday.delete()
  }
}

export function holidaysIn(organizationId: string, trx: TransactionClientContract) {
  return new HolidayRepository(organizationId, trx)
}
