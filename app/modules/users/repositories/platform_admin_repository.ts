import PlatformAdmin from '#models/platform_admin'

/** @platformScope — platform_admins is a global table (docs/backend/00 §6). */
export class PlatformAdminRepository {
  async isActive(userId: string): Promise<boolean> {
    const admin = await PlatformAdmin.query()
      .where('user_id', userId)
      .where('is_active', true)
      .first()
    return admin !== null
  }
}

export default new PlatformAdminRepository()
