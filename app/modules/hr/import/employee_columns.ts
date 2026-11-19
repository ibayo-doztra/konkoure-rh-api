/**
 * Columns of the employee import and export (docs/backend/07 §1.7, 08 §9). The
 * export writes the French headers; the import accepts the French or English
 * header of each column, case and accents ignored, so an export can be
 * edited and imported back.
 */
export const EMPLOYEE_COLUMNS = [
  { key: 'employeeNumber', fr: 'Matricule', en: 'Employee number' },
  { key: 'lastName', fr: 'Nom', en: 'Last name' },
  { key: 'firstName', fr: 'Prénom', en: 'First name' },
  { key: 'email', fr: 'E-mail', en: 'Email' },
  { key: 'phone', fr: 'Téléphone', en: 'Phone' },
  { key: 'jobTitle', fr: 'Poste', en: 'Job title' },
  { key: 'department', fr: 'Département', en: 'Department' },
  { key: 'manager', fr: 'Manager', en: 'Manager' },
  { key: 'hireDate', fr: "Date d'embauche", en: 'Hire date' },
  { key: 'birthDate', fr: 'Date de naissance', en: 'Birth date' },
] as const

/** Export only: computed or read-only columns, ignored by the import. */
export const EXPORT_ONLY_COLUMNS = [
  { key: 'status', fr: 'Statut', en: 'Status' },
  { key: 'endDate', fr: 'Date de fin', en: 'End date' },
  { key: 'contractType', fr: 'Type de contrat', en: 'Contract type' },
] as const

export type ImportColumn = (typeof EMPLOYEE_COLUMNS)[number]['key']

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()

const ALIASES = new Map<string, ImportColumn>(
  EMPLOYEE_COLUMNS.flatMap((column) => [
    [normalize(column.fr), column.key],
    [normalize(column.en), column.key],
    [normalize(column.key), column.key],
  ])
)

/** Position of each known column in a header row; unknown headers are ignored. */
export function mapHeader(header: string[]): Map<ImportColumn, number> {
  const positions = new Map<ImportColumn, number>()
  header.forEach((cell, index) => {
    const key = ALIASES.get(normalize(cell))
    if (key && !positions.has(key)) positions.set(key, index)
  })
  return positions
}

/** `Prénom Nom` key used to resolve a manager by name, case and accents ignored. */
export const personKey = (firstName: string, lastName: string) =>
  normalize(`${firstName}${lastName}`)

export const departmentKey = (name: string) => normalize(name)
