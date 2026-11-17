import type { ApiBody } from '@foadonis/openapi/decorators'

type BodySchema = NonNullable<Parameters<typeof ApiBody>[0]['schema']>

/**
 * OpenAPI body of a validator using `.confirmed()`: VineJS leaves the
 * `<field>_confirmation` companion out of its JSON schema, so the generated
 * docs would describe a request the validator rejects.
 */
export function confirmedBody(
  validator: { toJSONSchema(): object },
  field = 'password'
): BodySchema {
  const schema = validator.toJSONSchema() as {
    properties: Record<string, unknown>
    required?: string[]
  }
  const confirmation = `${field}_confirmation`
  schema.properties[confirmation] = schema.properties[field]
  schema.required = [...(schema.required ?? []), confirmation]
  return schema as BodySchema
}
