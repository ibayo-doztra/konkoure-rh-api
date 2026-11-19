import { DateTime } from 'luxon'
import type PublicHoliday from '#models/public_holiday'
import { AppException } from '#shared/exceptions/app_exception'
import { withTenant } from '#shared/tenant/with_tenant'
import type { TenantContext } from '#shared/tenant/tenant_context'
import organizations from '#modules/organizations/repositories/organization_repository'
import { holidaysIn, type HolidayRepository } from '#modules/leaves/repositories/holiday_repository'
import { GUINEA_FIXED_HOLIDAYS } from '#modules/leaves/leave_rules'

export interface HolidayInput {
  name?: string
  date?: DateTime
  isMovable?: boolean
  isRecurring?: boolean
}

const day = (value: DateTime) => value.toISODate()!

const dateTaken = () =>
  new AppException('E_CONFLICT', {
    details: [{ field: 'date', rule: 'unique', message: 'validation.holiday.dateTaken' }],
  })

/** Public holidays of the organization (docs/backend/06 §7, 07 §9). */
export class HolidayService {
  /** Holidays of `year`, the current one in the organization timezone by default. */
  list(tenant: TenantContext, year?: number): Promise<PublicHoliday[]> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const target = year ?? (await this.currentYear(organizationId, trx))
      return holidaysIn(organizationId, trx).ofYear(target)
    })
  }

  create(
    tenant: TenantContext,
    input: Required<Pick<HolidayInput, 'name' | 'date'>> & HolidayInput
  ): Promise<PublicHoliday> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const holidays = holidaysIn(organizationId, trx)
      await this.assertFree(holidays, day(input.date))
      return holidays.create({
        name: input.name,
        date: input.date,
        isMovable: input.isMovable ?? false,
        isRecurring: input.isRecurring ?? false,
      })
    })
  }

  update(tenant: TenantContext, id: string, input: HolidayInput): Promise<PublicHoliday> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const holidays = holidaysIn(organizationId, trx)
      const holiday = await holidays.findForUpdate(id)
      if (!holiday) throw new AppException('E_NOT_FOUND')
      if (input.date) await this.assertFree(holidays, day(input.date), id)
      holiday.merge(
        Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
      )
      await holidays.save(holiday)
      return holiday
    })
  }

  async remove(tenant: TenantContext, id: string) {
    const { organizationId } = tenant
    await withTenant(organizationId, async (trx) => {
      const holidays = holidaysIn(organizationId, trx)
      const holiday = await holidays.findForUpdate(id)
      if (!holiday) throw new AppException('E_NOT_FOUND')
      await holidays.remove(holiday)
    })
  }

  /**
   * Copies the fixed Guinean holidays of `year` (07 §9); dates already set are
   * kept as they are. Movable holidays are entered by hand.
   */
  importYear(tenant: TenantContext, year: number): Promise<PublicHoliday[]> {
    const { organizationId } = tenant
    return withTenant(organizationId, async (trx) => {
      const holidays = holidaysIn(organizationId, trx)
      for (const holiday of GUINEA_FIXED_HOLIDAYS) {
        const date = DateTime.fromObject({ year, month: holiday.month, day: holiday.day })
        if (await holidays.dateTaken(day(date))) continue
        await holidays.create({ name: holiday.name, date, isMovable: false, isRecurring: false })
      }
      return holidays.ofYear(year)
    })
  }

  private async assertFree(holidays: HolidayRepository, date: string, exceptId?: string) {
    if (await holidays.dateTaken(date, exceptId)) throw dateTaken()
  }

  private async currentYear(
    organizationId: string,
    trx: Parameters<typeof organizations.findActive>[1]
  ) {
    const organization = await organizations.findActive(organizationId, trx)
    if (!organization) throw new AppException('E_NOT_FOUND')
    return DateTime.now().setZone(organization.timezone).year
  }
}

export default new HolidayService()
