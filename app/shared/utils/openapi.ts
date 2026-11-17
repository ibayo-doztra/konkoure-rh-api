import type { ApiBody } from '@foadonis/openapi/decorators'

type BodySchema = NonNullable<Parameters<typeof ApiBody>[0]['schema']>

/**
 * OpenAPI body of a validator using `.confirmed()`: VineJS leaves the
 * `<field>_confirmation` companion out of its JSON schema, so the generated
 * docs would describe a request the validator rejects.
 */
export function confirmedBody(
  validator: { toJSONSchema(): object },
  field = 'password',
  /** Top-level keys that are not part of the body, such as `params`. */
  omit: string[] = []
): BodySchema {
  const schema = validator.toJSONSchema() as {
    properties: Record<string, unknown>
    required?: string[]
  }
  for (const key of omit) delete schema.properties[key]
  const confirmation = `${field}_confirmation`
  schema.properties[confirmation] = schema.properties[field]
  schema.required = [...(schema.required ?? []).filter((key) => !omit.includes(key)), confirmation]
  return schema as BodySchema
}
