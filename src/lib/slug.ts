/** Fill only a blank slug; saved and manually entered addresses are never rewritten. */
export function fillEmptySlug(value: unknown, title: unknown): unknown {
  if (value != null && (typeof value !== 'string' || value.trim() !== '')) return value
  if (typeof title !== 'string') return value
  return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
