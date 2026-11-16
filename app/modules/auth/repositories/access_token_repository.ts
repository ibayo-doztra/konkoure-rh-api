import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { AccessToken } from '@adonisjs/auth/access_tokens'

/** Read-only lookups on `auth_access_tokens` that the auth guard does not expose. */
export class AccessTokenRepository {
  /**
   * True when the bearer value designates a known token whose lifetime is over:
   * the API answers `E_TOKEN_EXPIRED` so the client refreshes (docs/backend/04 §1).
   */
  async isExpired(bearerValue: string): Promise<boolean> {
    const decoded = AccessToken.decode('oat_', bearerValue)
    if (!decoded) return false
    const row = await db
      .from('auth_access_tokens')
      .where('id', decoded.identifier)
      .select('expires_at')
      .first()
    if (!row?.expires_at) return false
    return DateTime.fromJSDate(row.expires_at) <= DateTime.now()
  }
}

export default new AccessTokenRepository()
