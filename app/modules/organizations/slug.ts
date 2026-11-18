const MAX_LENGTH = 60

/**
 * URL slug of an organization name, used by the public careers pages:
 * lower-case ASCII letters, digits and single dashes ("Société Générale
 * Guinée" ⇒ "societe-generale-guinee").
 */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, '')
  return slug || 'organisation'
}

/** `base`, then `base-2`, `base-3`… kept within the maximum length. */
export function slugCandidate(base: string, attempt: number): string {
  if (attempt <= 1) return base
  const suffix = `-${attempt}`
  return `${base.slice(0, MAX_LENGTH - suffix.length).replace(/-+$/g, '')}${suffix}`
}
