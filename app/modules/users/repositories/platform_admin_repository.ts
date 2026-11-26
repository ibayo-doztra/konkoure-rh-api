import PlatformAdmin from '#models/platform_admin'

/** @platformScope — platform_admins is a global table (docs/backend/00 §6). */
export class PlatformAdminRepository {
  /** The active admin record of a user, if any. */
  activeOf(userId: string) {
    return PlatformAdmin.query().where('user_id', userId).where('is_active', true).first()
  }

  /** Level of the active admin record, `null` for anyone else (inactive included). */
  async levelOf(userId: string): Promise<'root' | 'support' | null> {
    const admin = await this.activeOf(userId)
    return admin?.level ?? null
  }

  async isActive(userId: string): Promise<boolean> {
    const admin = await PlatformAdmin.query()
      .where('user_id', userId)
      .where('is_active', true)
      .first()
    return admin !== null
  }
}

export default new PlatformAdminRepository()
