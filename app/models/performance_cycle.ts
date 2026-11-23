import { beforeCreate } from '@adonisjs/lucid/orm'
import { PerformanceCycleSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type CycleFrequency = PerformanceCycleSchema['frequency']
export type CycleStatus = PerformanceCycleSchema['status']

/** Evaluation cycle (docs/backend/02 §8). Never serialized directly. */
export default class PerformanceCycle extends PerformanceCycleSchema {
  static table = 'performance_cycles'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(cycle: PerformanceCycle) {
    cycle.id ??= newId()
  }
}
