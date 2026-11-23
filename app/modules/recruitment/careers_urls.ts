import { authSettings } from '#modules/auth/auth_settings'

/**
 * Public pages of the web app (decision of 2026-11-23): the organization at
 * `/careers/:orgSlug`, an offer at `/careers/:orgSlug/jobs/:jobSlug`.
 */
export function careersJobUrl(organizationSlug: string, jobSlug: string) {
  return `${authSettings.webAppUrl}/careers/${encodeURIComponent(organizationSlug)}/jobs/${encodeURIComponent(jobSlug)}`
}
