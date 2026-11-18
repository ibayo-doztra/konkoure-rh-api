import vine from '@vinejs/vine'

const STATUSES = ['active', 'on_leave', 'suspended', 'terminated'] as const
const SORTS = [
  'last_name',
  '-last_name',
  'hire_date',
  '-hire_date',
  'created_at',
  '-created_at',
] as const

const params = () => vine.object({ id: vine.string().uuid() })
const page = () => vine.number().withoutDecimals().min(1).max(10_000).optional()
const perPage = () => vine.number().withoutDecimals().min(1).max(100).optional()

const address = () =>
  vine
    .object({
      line1: vine.string().trim().maxLength(200).optional(),
      city: vine.string().trim().maxLength(80).optional(),
      country: vine.string().trim().fixedLength(2).optional(),
    })
    .optional()

const emergencyContact = () =>
  vine
    .object({
      name: vine.string().trim().maxLength(120).optional(),
      phone: vine.string().trim().maxLength(30).optional(),
      relation: vine.string().trim().maxLength(60).optional(),
    })
    .optional()

const salary = () => vine.number().min(0).max(1_000_000_000).nullable().optional()
const name = () => vine.string().trim().minLength(2).maxLength(80)

const optionalFields = {
  email: vine.string().trim().email().maxLength(255).toLowerCase().nullable().optional(),
  phone: vine.string().trim().maxLength(30).nullable().optional(),
  employeeNumber: vine.string().trim().maxLength(40).nullable().optional(),
  jobTitle: vine.string().trim().maxLength(120).nullable().optional(),
  departmentId: vine.string().uuid().nullable().optional(),
  managerId: vine.string().uuid().nullable().optional(),
  hireDate: vine.date().nullable().optional(),
  status: vine.enum(STATUSES).optional(),
  baseSalary: salary(),
  salaryCurrency: vine.string().trim().fixedLength(3).toUpperCase().nullable().optional(),
  birthDate: vine.date().nullable().optional(),
  address: address(),
  emergencyContact: emergencyContact(),
}

/** POST /org/employees (06-api-reference §4). */
export const createEmployeeValidator = vine.create({
  firstName: name(),
  lastName: name(),
  ...optionalFields,
})

/** PATCH /org/employees/:id: `null` clears an optional field. */
export const updateEmployeeValidator = vine.create({
  params: params(),
  firstName: name().optional(),
  lastName: name().optional(),
  ...optionalFields,
})

export const employeeIdValidator = vine.create({ params: params() })

const listFields = {
  page: page(),
  perPage: perPage(),
  q: vine.string().trim().minLength(1).maxLength(100).optional(),
  sort: vine.enum(SORTS).optional(),
  filter: vine
    .object({
      status: vine.enum(STATUSES).optional(),
      departmentId: vine.string().uuid().optional(),
      managerId: vine.string().uuid().optional(),
    })
    .optional(),
}

/** GET /org/employees: whitelisted filters and sort (01 §7). */
export const listEmployeesValidator = vine.create(listFields)

/** Employee lists nested under a resource (team, department). */
export const nestedEmployeesValidator = vine.create({ params: params(), ...listFields })

export const paginationValidator = vine.create({ page: page(), perPage: perPage() })
