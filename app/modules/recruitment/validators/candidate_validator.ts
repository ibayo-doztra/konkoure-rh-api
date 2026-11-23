import vine from '@vinejs/vine'

const STAGES = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'] as const
/** Sources a staff member may set; `careers` is reserved to the public form. */
const STAFF_SOURCES = ['referral', 'import', 'social'] as const

/** Guinean format `NNN NN NN NN`, stored as displayed (00-HANDOFF §4, 06 §11). */
const phone = () =>
  vine
    .string()
    .trim()
    .regex(/^\d{3} \d{2} \d{2} \d{2}$/)
const fullName = () => vine.string().trim().minLength(2).maxLength(150)
const email = () => vine.string().trim().email().maxLength(254)
const slug = () =>
  vine
    .string()
    .trim()
    .maxLength(80)
    .regex(/^[a-z0-9-]+$/)
const params = () => vine.object({ id: vine.string().uuid() })

const pieces = {
  coverLetter: vine.file().optional(),
  documents: vine.record(vine.file()).optional(),
}

/** POST /public/careers/:orgSlug/jobs/:jobSlug/apply (multipart). */
export const applyValidator = vine.create({
  params: vine.object({ orgSlug: slug(), jobSlug: slug() }),
  fullName: fullName(),
  email: email(),
  phone: phone(),
  cv: vine.file(),
  ...pieces,
  /** Honeypot (05 §4): hidden from people, filled by bots. */
  website: vine.string().maxLength(0).optional(),
})

/** POST …/apply/check (decision of 2026-11-23): duplicate check before sending files. */
export const applyCheckValidator = vine.create({
  params: vine.object({ orgSlug: slug(), jobSlug: slug() }),
  email: email(),
  phone: phone(),
})

export const listCandidatesValidator = vine.create({
  page: vine.number().withoutDecimals().min(1).max(10_000).optional(),
  perPage: vine.number().withoutDecimals().min(1).max(100).optional(),
  q: vine.string().trim().minLength(1).maxLength(100).optional(),
  filter: vine
    .object({
      jobId: vine.string().uuid().optional(),
      stage: vine.enum(STAGES).optional(),
    })
    .optional(),
})

/** POST /org/recruitment/candidates (multipart): pieces optional for the staff. */
export const createCandidateValidator = vine.create({
  jobId: vine.string().uuid(),
  fullName: fullName(),
  email: email().optional(),
  phone: phone().optional(),
  source: vine.enum(STAFF_SOURCES).optional(),
  cv: vine.file().optional(),
  ...pieces,
})

export const updateCandidateValidator = vine.create({
  params: params(),
  fullName: fullName().optional(),
  email: email().nullable().optional(),
  phone: phone().nullable().optional(),
  source: vine.enum(STAFF_SOURCES).nullable().optional(),
})

export const candidateIdValidator = vine.create({ params: params() })

export const stageValidator = vine.create({
  params: params(),
  stage: vine.enum(STAGES),
  reason: vine.string().trim().maxLength(2000).nullable().optional(),
})

export const hireValidator = vine.create({
  params: params(),
  firstName: vine.string().trim().minLength(1).maxLength(100).optional(),
  lastName: vine.string().trim().minLength(1).maxLength(100).optional(),
  hireDate: vine.date().optional(),
})

export const documentUrlValidator = vine.create({
  params: vine.object({
    id: vine.string().uuid(),
    key: vine
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_]{0,39}$/),
  }),
})

export const noteValidator = vine.create({
  params: params(),
  body: vine.string().trim().minLength(1).maxLength(5000),
})

export const noteIdValidator = vine.create({
  params: vine.object({ id: vine.string().uuid(), noteId: vine.string().uuid() }),
})
