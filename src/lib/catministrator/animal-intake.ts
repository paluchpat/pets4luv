import { DraftRequestError } from './requests'

export type IntakeDetails = {
  name?: string
  species?: 'cat' | 'dog'
  sex?: 'male' | 'female'
  ageGroup?: 'baby' | 'young' | 'adult' | 'senior'
  breed?: string
  summary?: string
  description?: string
}

export function readIntakeDetails(input: unknown): IntakeDetails {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new DraftRequestError('I couldn’t read animal details from that image.')
  }
  const value = input as Record<string, unknown>
  const detail: IntakeDetails = {}
  for (const [field, max] of [['name', 100], ['breed', 150], ['summary', 220], ['description', 1600]] as const) {
    const raw = value[field]
    if (typeof raw === 'string' && raw.trim()) detail[field] = raw.trim().slice(0, max)
  }
  if (value.species === 'cat' || value.species === 'dog') detail.species = value.species
  if (value.sex === 'male' || value.sex === 'female') detail.sex = value.sex
  if (value.ageGroup === 'baby' || value.ageGroup === 'young' || value.ageGroup === 'adult' || value.ageGroup === 'senior') {
    detail.ageGroup = value.ageGroup
  }
  if (detail.name && !/^[\p{L}\p{N}][\p{L}\p{N} .’'&()-]*$/u.test(detail.name)) {
    delete detail.name
  }
  return detail
}
