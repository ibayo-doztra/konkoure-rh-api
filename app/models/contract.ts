import { beforeCreate } from '@adonisjs/lucid/orm'
import { ContractSchema } from '#database/schema'
import { newId } from '#shared/utils/crypto'

export type ContractStatus = ContractSchema['status']
export type ContractType = ContractSchema['type']

/**
 * Employment contract (docs/backend/02 §4). Never serialized directly: salary
 * and notes depend on the viewer, the document path is never exposed.
 */
export default class Contract extends ContractSchema {
  static table = 'contracts'
  static selfAssignPrimaryKey = true

  @beforeCreate()
  static assignId(contract: Contract) {
    contract.id ??= newId()
  }
}
