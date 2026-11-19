import type { Where } from 'payload'
import type { Homepage } from '../payload-types'

export const featuredAnimalLimit = 3

export const featuredAnimalEligibility: Where = {
  status: { equals: 'available' },
  _status: { equals: 'published' },
}

export function featuredAnimalIds(rows: Homepage['featuredAnimals']): number[] {
  return [...new Set((rows || []).slice(0, featuredAnimalLimit).flatMap(({ animal }) => {
    const id = typeof animal === 'object' ? animal?.id : animal
    return typeof id === 'number' ? [id] : []
  }))]
}
