import vine from '@vinejs/vine'

const params = () => vine.object({ id: vine.string().uuid() })
const page = () => vine.number().withoutDecimals().min(1).max(10_000).optional()
const perPage = () => vine.number().withoutDecimals().min(1).max(200).optional()

const ring = () => vine.array(vine.array(vine.number()).fixedLength(2)).minLength(4).maxLength(100)

const zoneFields = {
  shape: vine.enum(['circle', 'polygon'] as const).optional(),
  latitude: vine.number().min(-90).max(90).nullable().optional(),
  longitude: vine.number().min(-180).max(180).nullable().optional(),
  radiusMeters: vine.number().withoutDecimals().min(20).max(5000).nullable().optional(),
  /** Exterior ring of a GeoJSON polygon: `[longitude, latitude]` pairs, closed. */
  polygon: ring().nullable().optional(),
  isActive: vine.boolean().optional(),
  timezone: vine.string().trim().maxLength(64).nullable().optional(),
}

/** POST /org/timeclock/zones (02 §5, 07 §2.1). */
export const createZoneValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(120),
  ...zoneFields,
})

export const updateZoneValidator = vine.create({
  params: params(),
  name: vine.string().trim().minLength(2).maxLength(120).optional(),
  ...zoneFields,
})

export const idValidator = vine.create({ params: params() })

const punchFields = {
  type: vine.enum(['in', 'out'] as const).optional(),
  punchedAt: vine.date({ formats: ['iso8601'] }).optional(),
  latitude: vine.number().min(-90).max(90).optional(),
  longitude: vine.number().min(-180).max(180).optional(),
  accuracyMeters: vine.number().min(0).max(10000).optional(),
  deviceId: vine.string().trim().maxLength(120).optional(),
}

/** POST /org/timeclock/scan (06 §6). */
export const scanValidator = vine.create({
  badgeUid: vine.string().trim().minLength(4).maxLength(64),
  ...punchFields,
  clientPunchId: vine.string().uuid().optional(),
})

/** POST /org/timeclock/punch: same fields, without `badgeUid`. */
export const punchValidator = vine.create({
  ...punchFields,
  clientPunchId: vine.string().uuid().optional(),
})

/** POST /org/timeclock/sync: 1 to 200 punches, `clientPunchId` mandatory. */
export const syncValidator = vine.create({
  punches: vine
    .array(
      vine.object({
        badgeUid: vine.string().trim().minLength(4).maxLength(64).optional(),
        ...punchFields,
        clientPunchId: vine.string().uuid(),
      })
    )
    .minLength(1)
    .maxLength(200),
})

export const listLogsValidator = vine.create({
  page: page(),
  perPage: perPage(),
  filter: vine
    .object({
      employeeId: vine.string().uuid().optional(),
      from: vine.date({ formats: ['iso8601'] }).optional(),
      to: vine.date({ formats: ['iso8601'] }).optional(),
      source: vine.enum(['nfc', 'manual', 'mobile_gps', 'kiosk', 'import'] as const).optional(),
      anomaly: vine.enum(['out_of_zone', 'low_accuracy', 'clock_drift'] as const).optional(),
    })
    .optional(),
})

/** PATCH /org/timeclock/logs/:id (07 §2.9). */
export const correctLogValidator = vine.create({
  params: params(),
  type: vine.enum(['in', 'out'] as const).optional(),
  punchedAt: vine.date({ formats: ['iso8601'] }).optional(),
  workZoneId: vine.string().uuid().nullable().optional(),
  notes: vine.string().trim().maxLength(1000).nullable().optional(),
})

/** POST /org/employees/:id/badge */
export const assignBadgeValidator = vine.create({
  params: params(),
  badgeUid: vine.string().trim().minLength(4).maxLength(64),
})

export const badgeEventsValidator = vine.create({
  page: page(),
  perPage: perPage(),
  employeeId: vine.string().uuid().optional(),
})

/** POST /org/timeclock/device-tokens (decision of 2026-11-19). */
export const createDeviceTokenValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(80),
  expiresInDays: vine.number().withoutDecimals().min(1).max(365).optional(),
})
