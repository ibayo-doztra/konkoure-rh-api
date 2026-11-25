import PlatformSetting from '#models/platform_setting'

/** Key that opens every module to every organization (02 §10, before the launch). */
export const MODULES_OPEN_FOR_TESTING = 'modules_open_for_testing'

/** @platformScope — reads of `platform_settings`, outside any tenant. */
export async function platformFlag(key: string): Promise<boolean> {
  const setting = await PlatformSetting.find(key)
  return setting?.value === true
}
