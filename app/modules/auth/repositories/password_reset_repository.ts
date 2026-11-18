import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import PasswordResetToken from '#models/password_reset_token'

export class PasswordResetRepository {
  create(
    data: Pick<PasswordResetToken, 'userId' | 'tokenHash' | 'expiresAt'>,
    trx: TransactionClientContract
  ) {
    return PasswordResetToken.create(data, { client: trx })
  }

  findByHashForUpdate(tokenHash: string, trx: TransactionClientContract) {
    return PasswordResetToken.query({ client: trx })
      .where('token_hash', tokenHash)
      .forUpdate()
      .first()
  }

  /** A new request supersedes every pending link of the user. */
  invalidatePending(userId: string, trx: TransactionClientContract) {
    return PasswordResetToken.query({ client: trx })
      .where('user_id', userId)
      .whereNull('used_at')
      .update({ used_at: DateTime.now().toSQL() })
  }

  markUsed(token: PasswordResetToken, trx: TransactionClientContract) {
    token.useTransaction(trx)
    token.usedAt = DateTime.now()
    return token.save()
  }
}

export default new PasswordResetRepository()
