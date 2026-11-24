import vine from '@vinejs/vine'
import { SUCCESSION_READINESS } from '#models/succession_plan'

const EMPLOYEE_STATUSES = ['active', 'on_leave', 'suspended', 'terminated'] as const

const params = () => vine.object({ id: vine.string().uuid() })
const paging = {
  page: vine.number().withoutDecimals().min(1).max(10_000).optional(),
  perPage: vine.number().withoutDecimals().min(1).max(100).optional(),
}

/* Succession plans (docs/backend/02 §8, 06 §10) */

const successionFields = {
  currentEmployeeId: vine.string().uuid().nullable().optional(),
  successorEmployeeId: vine.string().uuid().nullable().optional(),
  readiness: vine.enum(SUCCESSION_READINESS).nullable().optional(),
  notes: vine.string().trim().maxLength(5000).nullable().optional(),
}
const positionTitle = () => vine.string().trim().minLength(1).maxLength(200)

export const listSuccessionValidator = vine.create({
  ...paging,
  filter: vine
    .object({
      readiness: vine.enum(SUCCESSION_READINESS).optional(),
      employeeId: vine.string().uuid().optional(),
    })
    .optional(),
})

export const createSuccessionValidator = vine.create({
  positionTitle: positionTitle(),
  ...successionFields,
})

export const updateSuccessionValidator = vine.create({
  params: params(),
  positionTitle: positionTitle().optional(),
  ...successionFields,
})

export const successionIdValidator = vine.create({ params: params() })

/* Skills matrix (decision of 2026-11-24) */

export const skillsMatrixValidator = vine.create({
  ...paging,
  filter: vine
    .object({
      departmentId: vine.string().uuid().optional(),
      skillId: vine.array(vine.string().uuid()).maxLength(50).optional(),
      status: vine.enum(EMPLOYEE_STATUSES).optional(),
    })
    .optional(),
})

/** PUT /org/talents/skills-matrix: `level: null` removes the assessment. */
export const updateSkillsMatrixValidator = vine.create({
  entries: vine
    .array(
      vine.object({
        employeeId: vine.string().uuid(),
        skillId: vine.string().uuid(),
        level: vine.number().withoutDecimals().min(1).max(5).nullable(),
      })
    )
    .minLength(1)
    .maxLength(500),
})
