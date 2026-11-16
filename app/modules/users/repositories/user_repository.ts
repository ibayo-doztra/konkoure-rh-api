import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import User from '#models/user'

/**
 * Accounts are global, not tenant data (docs/backend/02 §3: users carry no
 * organization_id). Every lookup excludes soft-deleted accounts.
 */
export class UserRepository {
  findByEmail(email: string, trx?: TransactionClientContract) {
    return User.query({ client: trx }).where('email', email).whereNull('deleted_at').first()
  }

  findById(id: string, trx?: TransactionClientContract) {
    return User.query({ client: trx }).where('id', id).whereNull('deleted_at').first()
  }

  /** Row lock, for read-modify-write of counters (failed attempts, lockout). */
  findByIdForUpdate(id: string, trx: TransactionClientContract) {
    return User.query({ client: trx }).where('id', id).whereNull('deleted_at').forUpdate().first()
  }

  async emailExists(email: string, trx?: TransactionClientContract) {
    return (await this.findByEmail(email, trx)) !== null
  }

  create(
    data: Pick<User, 'email' | 'passwordHash' | 'fullName' | 'preferredLanguage'>,
    trx: TransactionClientContract
  ) {
    return User.create(data, { client: trx })
  }

  save(user: User, trx: TransactionClientContract) {
    user.useTransaction(trx)
    return user.save()
  }
}

export default new UserRepository()
