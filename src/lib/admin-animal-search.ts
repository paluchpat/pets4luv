import type { Where } from 'payload'
import { animalColorOptions } from './animal-colors'

const textFields = ['name', 'rescueIntakeID', 'breed', 'summary', 'description', 'careNeeds', 'compatibilityNotes', 'internalNotes']
export const adminAnimalSearchFields = [...textFields, 'species', 'sex', 'ageGroup', 'size', 'colors', 'status']

const exact = (field: string, value: string): Where => ({ [field]: { equals: value } })
const terms = new Map<string, Where>()
function aliases(words: string[], condition: Where) { for (const word of words) terms.set(word, condition) }
aliases(['male', 'males', 'boy', 'boys'], exact('sex', 'male'))
aliases(['female', 'females', 'girl', 'girls'], exact('sex', 'female'))
aliases(['cat', 'cats'], exact('species', 'cat'))
aliases(['dog', 'dogs'], exact('species', 'dog'))
for (const age of ['baby', 'young', 'adult', 'senior']) aliases([age], exact('ageGroup', age))
aliases(['older', 'seniors'], exact('ageGroup', 'senior'))
aliases(['kitten', 'kittens'], { and: [exact('species', 'cat'), exact('ageGroup', 'baby')] })
aliases(['puppy', 'puppies'], { and: [exact('species', 'dog'), exact('ageGroup', 'baby')] })
for (const size of ['small', 'medium', 'large']) aliases([size], exact('size', size))
for (const { value } of animalColorOptions) aliases([value], { colors: { contains: value } })
aliases(['grey'], { colors: { contains: 'gray' } })
aliases(['available', 'adoptable'], exact('status', 'available'))
aliases(['adopted'], exact('status', 'adopted'))
aliases(['pending', 'on-hold'], exact('status', 'on-hold'))
aliases(['published'], exact('_status', 'published'))
aliases(['draft', 'drafts', 'unpublished'], exact('_status', 'draft'))
const connectors = new Set(['a', 'an', 'the', 'and', 'show', 'me', 'find', 'looking', 'for', 'is', 'are', 'with', 'that', 'animal', 'animals', 'pet', 'pets'])
const companions: Record<string, string> = { dog: 'dogs', dogs: 'dogs', cat: 'cats', cats: 'cats', children: 'children', kids: 'children' }

/** Recognized details are exact criteria; ordinary words can match different profile text fields. */
export function buildAdminAnimalSearchWhere(search: string): Where {
  const tokens = [...search.slice(0, 300).matchAll(/"([^"]+)"|(\S+)/g)].map(match => ({
    value: (match[1] ?? match[2]).normalize('NFKC').replace(/^[,;:!?()]+|[,;:!?()]+$/g, ''),
    quoted: match[1] !== undefined,
  })).filter(token => token.value).slice(0, 30)
  const hasDetails = tokens.some(token => !token.quoted && terms.has(token.value.toLowerCase()))
  const groups: Where[][] = [[]]
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index], word = token.value.toLowerCase()
    if (!token.quoted) {
      if (word === 'or') { if (groups.at(-1)!.length) groups.push([]); continue }
      if (['good', 'friendly'].includes(word) && tokens[index + 1]?.value.toLowerCase() === 'with' && !tokens[index + 1]?.quoted) {
        const companion = tokens[index + 2]
        if (companion && !companion.quoted && companions[companion.value.toLowerCase()]) {
          groups.at(-1)!.push(exact('compatibility.' + companions[companion.value.toLowerCase()], 'yes'))
          index += 2
          continue
        }
      }
      if (word === 'on' && tokens[index + 1]?.value.toLowerCase() === 'hold' && !tokens[index + 1]?.quoted) {
        groups.at(-1)!.push(exact('status', 'on-hold')); index++; continue
      }
      if (hasDetails && connectors.has(word)) continue
      const detail = terms.get(word)
      if (detail) { groups.at(-1)!.push(structuredClone(detail)); continue }
    }
    groups.at(-1)!.push({ or: textFields.map(field => ({ [field]: { like: token.value } })) })
  }
  const clauses = groups.filter(group => group.length).map(group => group.length === 1 ? group[0] : { and: group })
  return clauses.length > 1 ? { or: clauses } : clauses[0] || {}
}

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
      const searchCriteria = buildAdminAnimalSearchWhere(phrase)
      return Object.keys(otherCriteria).length ? { and: [otherCriteria, searchCriteria] } : searchCriteria
    }
  }
  return {
    ...where,
    ...(where.and ? { and: where.and.map(clause => expandAdminAnimalSearch(clause)!) } : {}),
    ...(where.or ? { or: where.or.map(clause => expandAdminAnimalSearch(clause)!) } : {}),
  }
}
