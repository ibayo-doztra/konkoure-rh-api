/**
 * Defaults of `organizations.settings` (docs/backend/02 §11): any key absent
 * from the stored JSON takes the value defined here.
 */
export const organizationSettingsDefaults = {
  leave: {
    annualEntitlementDays: 30,
    allowNegativeBalance: true,
    maxNegativeDays: 5,
    countWeekends: false,
    countHolidays: false,
  },
  timeclock: {
    defaultRadiusMeters: 150,
    requireZone: true,
    allowManualPunch: true,
    maxAccuracyMeters: 100,
    duplicateWindowSeconds: 120,
  },
  performance: { ratingScale: 5, requireSignature: true },
  recruitment: { autoScore: true, notifyOnApplication: true },
  /** 9-box axes (07 §5.10): score ≤ lowMax is low, ≤ mediumMax medium, else high. */
  talents: { nineBox: { lowMax: 2, mediumMax: 3 } },
  branding: { primaryColor: '#0F7A5A' },
}

export type OrganizationSettings = typeof organizationSettingsDefaults
