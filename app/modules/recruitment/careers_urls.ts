import { authSettings } from '#modules/auth/auth_settings'

/**
 * Public pages of the web app (confirmed by the front on 2026-11-23): the
 * organization at `/careers/:orgSlug`, an offer at `/careers/:orgSlug/:jobSlug`.
 */
export function careersJobUrl(organizationSlug: string, jobSlug: string) {
  return `${authSettings.webAppUrl}/careers/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(jobSlug)}`
}
