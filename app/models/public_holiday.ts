import { beforeCreate } from '@adonisjs/lucid/orm'
import { PublicHolidaySchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

/** Public holiday of an organization (02 §6, 07 §9). */
export default class PublicHoliday extends PublicHolidaySchema {
  static table = 'public_holidays'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(publicHoliday: PublicHoliday) {
    publicHoliday.id ??= newId()
  }
}
