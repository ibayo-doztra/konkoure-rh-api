import vine from '@vinejs/vine'

const params = () => vine.object({ id: vine.string().uuid() })
const name = () => vine.string().trim().minLength(2).maxLength(120)

const optionalFields = {
  description: vine.string().trim().maxLength(2000).nullable().optional(),
  managerId: vine.string().uuid().nullable().optional(),
  parentDepartmentId: vine.string().uuid().nullable().optional(),
}

/** POST /org/departments: the columns of docs/backend/02 §4. */
export const createDepartmentValidator = vine.create({ name: name(), ...optionalFields })

export const updateDepartmentValidator = vine.create({
  params: params(),
  name: name().optional(),
  ...optionalFields,
})

export const departmentIdValidator = vine.create({ params: params() })

/** DELETE /org/departments/:id?reassignTo=<departmentId> (06 §5). */
export const deleteDepartmentValidator = vine.create({
  params: params(),
  reassignTo: vine.string().uuid().optional(),
})
