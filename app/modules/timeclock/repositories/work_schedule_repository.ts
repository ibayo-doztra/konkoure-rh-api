import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelAttributes } from '@adonisjs/lucid/types/model'
import WorkSchedule from '#models/work_schedule'
import { TenantRepository } from '#shared/base/tenant_repository'

/** Tenant-scoped work schedules (docs/backend/02 §6). */
export class WorkScheduleRepository extends TenantRepository<typeof WorkSchedule> {
  constructor(organizationId: string, trx: TransactionClientContract) {
    super(WorkSchedule, organizationId, trx)
  }

  create(data: Partial<ModelAttributes<WorkSchedule>>) {
    return WorkSchedule.create(
      { ...data, organizationId: this.organizationId },
      { client: this.trx }
    )
  }

  /** Templates first (default on top), then employees' own schedules, by name. */
  all() {
    return this.query()
      .orderByRaw('employee_id IS NOT NULL')
      .orderBy('is_default', 'desc')
      .orderBy('name', 'asc')
      .orderBy('id', 'asc')
  }

  async nameTaken(name: string, exceptId?: string) {
    const query = this.query().whereRaw('lower(name) = lower(?)', [name])
    if (exceptId) query.whereNot('id', exceptId)
    return (await query.first()) !== null
  }

  async employeeTaken(employeeId: string, exceptId?: string) {
    const query = this.query().where('employee_id', employeeId)
    if (exceptId) query.whereNot('id', exceptId)
    return (await query.first()) !== null
  }

  /** Only one default per organization: the new one replaces the former. */
  async clearDefault(exceptId?: string) {
    const query = this.query().where('is_default', true)
    if (exceptId) query.whereNot('id', exceptId)
    await query.update({ is_default: false })
  }

  /** The schedule that applies to an employee: their own, else the default, else none. */
  async resolve(employeeId: string): Promise<WorkSchedule | null> {
    const own = await this.query().where('employee_id', employeeId).first()
    return own ?? this.query().where('is_default', true).first()
  }

  async remove(schedule: WorkSchedule) {
    schedule.useTransaction(this.trx)
    await schedule.delete()
  }
}

export function workSchedulesIn(organizationId: string, trx: TransactionClientContract) {
  return new WorkScheduleRepository(organizationId, trx)
}
