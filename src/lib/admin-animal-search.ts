import type { Where } from 'payload'
import { adminAnimalTextFields, buildAnimalSearchWhere } from './animal-search'

export const adminAnimalSearchFields = [...adminAnimalTextFields, 'species', 'sex', 'ageGroup', 'size', 'colors', 'status']

/** Replace only Payload's complete generated search block, retaining filters and other API queries. */
export function expandAdminAnimalSearch(where: Where | undefined): Where | undefined {
  if (!where) return where
  if (where.or?.length === adminAnimalSearchFields.length) {
    const fields = new Set(adminAnimalSearchFields)
    let phrase: string | undefined
    const generated = where.or.every(clause => {
      const entries = Object.entries(clause)
      if (entries.length !== 1) return false
      const [field, condition] = entries[0]
      if (!fields.delete(field) || !condition || Array.isArray(condition) || typeof condition.like !== 'string' || Object.keys(condition).length !== 1) return false
      phrase ??= condition.like
      return condition.like === phrase
    })
    if (generated && !fields.size && phrase !== undefined) {
      const { or: _search, ...otherCriteria } = where
      const searchCriteria = buildAnimalSearchWhere(phrase, 'admin')
      return Object.keys(otherCriteria).length ? { and: [otherCriteria, searchCriteria] } : searchCriteria
    }
  }
  return {
    ...where,
    ...(where.and ? { and: where.and.map(clause => expandAdminAnimalSearch(clause)!) } : {}),
    ...(where.or ? { or: where.or.map(clause => expandAdminAnimalSearch(clause)!) } : {}),
  }
}
