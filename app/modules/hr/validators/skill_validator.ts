import vine from '@vinejs/vine'

const params = () => vine.object({ id: vine.string().uuid() })
const name = () => vine.string().trim().minLength(2).maxLength(120)
const category = () => vine.string().trim().maxLength(80).nullable().optional()

export const createSkillValidator = vine.create({ name: name(), category: category() })

export const updateSkillValidator = vine.create({
  params: params(),
  name: name().optional(),
  category: category(),
})

export const skillIdValidator = vine.create({ params: params() })

/** PUT /org/employees/:id/skills: an empty list clears the employee's skills. */
export const replaceEmployeeSkillsValidator = vine.create({
  params: params(),
  skills: vine
    .array(
      vine.object({
        skillId: vine.string().uuid(),
        level: vine.number().withoutDecimals().min(1).max(5),
        assessedAt: vine.date().nullable().optional(),
      })
    )
    .maxLength(200)
    .distinct('skillId'),
})
