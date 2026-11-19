import type { Where } from 'payload'
import { animalColorOptions } from './animal-colors'
import { gallerySearchMaxLength } from './gallery-filters'

const publicAnimalTextFields = ['name', 'breed', 'summary', 'description', 'careNeeds', 'compatibilityNotes']
export const adminAnimalTextFields = [...publicAnimalTextFields, 'rescueIntakeID', 'internalNotes']

const exact = (field: string, value: string): Where => ({ [field]: { equals: value } })
const terms = new Map<string, Where>()
function aliases(words: string[], condition: Where, entries = terms) {
  for (const word of words) entries.set(word, condition)
}
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
const adminTerms = new Map(terms)
aliases(['adopted'], exact('status', 'adopted'), adminTerms)
aliases(['pending', 'on-hold'], exact('status', 'on-hold'), adminTerms)
aliases(['published'], exact('_status', 'published'), adminTerms)
aliases(['draft', 'drafts', 'unpublished'], exact('_status', 'draft'), adminTerms)
const connectors = new Set(['a', 'an', 'the', 'and', 'show', 'me', 'find', 'looking', 'for', 'is', 'are', 'with', 'that', 'animal', 'animals', 'pet', 'pets'])
const companions = new Map([
  ['dog', 'dogs'], ['dogs', 'dogs'], ['cat', 'cats'], ['cats', 'cats'], ['children', 'children'], ['kids', 'children'],
])

/** Recognized details are exact criteria; ordinary words can match different profile text fields. */
export function buildAnimalSearchWhere(search: string, audience: 'public' | 'admin'): Where {
  const admin = audience === 'admin'
  const textFields = admin ? adminAnimalTextFields : publicAnimalTextFields
  const detailTerms = admin ? adminTerms : terms
  const tokens = [...search.slice(0, admin ? 300 : gallerySearchMaxLength).matchAll(/"([^"]+)"|(\S+)/g)].map(match => ({
    value: (match[1] ?? match[2]).normalize('NFKC').replace(/^[,;:!?()]+|[,;:!?()]+$/g, ''),
    quoted: match[1] !== undefined,
  })).filter(token => token.value).slice(0, 30)
  const hasDetails = tokens.some(token => !token.quoted && detailTerms.has(token.value.toLowerCase()))
  const groups: Where[][] = [[]]
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    const word = token.value.toLowerCase()
    if (!token.quoted) {
      if (word === 'or') {
        if (groups.at(-1)!.length) groups.push([])
        continue
      }
      if (['good', 'friendly'].includes(word) && tokens[index + 1]?.value.toLowerCase() === 'with' && !tokens[index + 1]?.quoted) {
        const companion = tokens[index + 2]
        const field = companion && !companion.quoted ? companions.get(companion.value.toLowerCase()) : undefined
        if (field) {
          groups.at(-1)!.push(exact('compatibility.' + field, 'yes'))
          index += 2
          continue
        }
      }
      if (admin && word === 'on' && tokens[index + 1]?.value.toLowerCase() === 'hold' && !tokens[index + 1]?.quoted) {
        groups.at(-1)!.push(exact('status', 'on-hold'))
        index++
        continue
      }
      if (hasDetails && connectors.has(word)) continue
      const detail = detailTerms.get(word)
      if (detail) {
        groups.at(-1)!.push(structuredClone(detail))
        continue
      }
    }
    // Payload's "like" splits on spaces, so quoted phrases use a contiguous text match.
    const operator = token.quoted ? 'contains' : 'like'
    groups.at(-1)!.push({ or: textFields.map(field => ({ [field]: { [operator]: token.value } })) })
  }
  const clauses = groups.filter(group => group.length).map(group => group.length === 1 ? group[0] : { and: group })
  return clauses.length > 1 ? { or: clauses } : clauses[0] || {}
}
