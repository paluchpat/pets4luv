import type { Where } from 'payload'

export const animalAgeGroups = [
  { value: 'baby', label: 'Baby', range: '< 1 year' },
  { value: 'young', label: 'Young', range: '1–3 years' },
  { value: 'adult', label: 'Adult', range: '3–8 years' },
  { value: 'senior', label: 'Senior', range: '> 8 years' },
] as const

function ageCutoffs(now: Date) {
  function birthday(yearsAgo: number, dayOffset = 0) {
    const year = now.getUTCFullYear() - yearsAgo
    const month = now.getUTCMonth()
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const day = Math.min(now.getUTCDate(), lastDay) + dayOffset
    // The end of the day also compares correctly to legacy dates without a time.
    return new Date(Date.UTC(year, month, day, 23, 59, 59, 999))
  }
  return [birthday(1), birthday(3), birthday(8, -1)]
}

export function animalAgeGroupAtBirthDate(birthDate: Date, now = new Date()) {
  const index = ageCutoffs(now).filter(cutoff => birthDate <= cutoff).length
  return animalAgeGroups[index].value
}

export function animalAgeGroupWhere(group: string | undefined, now = new Date()): Where | undefined {
  const index = animalAgeGroups.findIndex(option => option.value === group)
  if (index < 0) return undefined
  const cutoffs = ageCutoffs(now)
  const youngerCutoff = cutoffs[index - 1]
  const olderCutoff = cutoffs[index]
  return { or: [
    { estimatedBirthDate: {
      ...(youngerCutoff && { less_than_equal: youngerCutoff.toISOString() }),
      ...(olderCutoff && { greater_than: olderCutoff.toISOString() }),
    } },
    { estimatedBirthDate: { exists: false }, ageGroup: { equals: group } },
  ] }
}

type AgeDetails = { ageGroup?: string | null; estimatedBirthDate?: string | null }

/** Keep the incoming order for ties and for animals that only have an age group. */
export function orderAnimalsByAge<T extends AgeDetails>(animals: T[], oldestFirst: boolean, now = new Date()): T[] {
  const cutoffs = ageCutoffs(now).map(cutoff => cutoff.getTime())
  const lastGroup = animalAgeGroups.length - 1
  const direction = oldestFirst ? -1 : 1
  return animals.map(animal => {
    const date = Date.parse(animal.estimatedBirthDate || '')
    const birthday = Number.isFinite(date) ? date : null
    const group = birthday === null
      ? animalAgeGroups.findIndex(option => option.value === animal.ageGroup)
      : cutoffs.filter(cutoff => birthday <= cutoff).length
    const rank = group < 0 ? animalAgeGroups.length : oldestFirst ? lastGroup - group : group
    return { animal, birthday, rank }
  }).sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    if (a.birthday === null || b.birthday === null) return Number(a.birthday === null) - Number(b.birthday === null)
    return direction * (b.birthday - a.birthday)
  }).map(entry => entry.animal)
}
