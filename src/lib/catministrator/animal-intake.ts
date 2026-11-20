import { animalAgeGroupAtBirthDate, animalAgeGroups } from '../animal-age'
import { animalColorOptions, isAnimalColor, type AnimalColor } from '../animal-colors'
import { DraftRequestError } from './requests'

const textLimits = {
  name: 100,
  breed: 150,
  summary: 220,
  description: 1600,
  rescueIntakeID: 100,
  careNeeds: 600,
  compatibilityNotes: 600,
  internalNotes: 1200,
}
const species = ['cat', 'dog'] as const
const sexes = ['male', 'female'] as const
const sizes = ['small', 'medium', 'large'] as const
const statuses = ['available', 'on-hold', 'adopted'] as const
const ageGroups = animalAgeGroups.map(option => option.value)
const compatibility = ['yes', 'no', 'conditional'] as const
export const compatibilityFields = ['cats', 'dogs', 'children'] as const
type CompatibilityField = typeof compatibilityFields[number]
type CompatibilityAssessment = typeof compatibility[number]

export type IntakeDetails = Partial<Record<keyof typeof textLimits, string>> & {
  species?: typeof species[number]
  sex?: typeof sexes[number]
  ageGroup?: typeof ageGroups[number]
  size?: typeof sizes[number]
  status?: typeof statuses[number]
  estimatedBirthDate?: string
  weight?: number
  colors?: AnimalColor[]
  compatibility?: Partial<Record<CompatibilityField, CompatibilityAssessment>>
}

const nullableText = { type: ['string', 'null'] }
function nullableChoice(options: readonly string[]) {
  return { type: ['string', 'null'], enum: [...options, null] }
}

export const intakeDetailProperties = {
  ...Object.fromEntries(Object.keys(textLimits).map(field => [field, nullableText])),
  species: nullableChoice(species),
  sex: nullableChoice(sexes),
  ageGroup: nullableChoice(ageGroups),
  size: nullableChoice(sizes),
  status: nullableChoice(statuses),
  estimatedBirthDate: nullableText,
  weight: { type: ['number', 'null'] },
  colors: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        tag: { type: 'string', enum: animalColorOptions.map(color => color.value) },
        confidence: { type: 'string', enum: ['high', 'uncertain'] },
        evidence: { type: 'string' },
      },
      required: ['tag', 'confidence', 'evidence'],
      additionalProperties: false,
    },
  },
  compatibility: {
    type: 'object',
    properties: Object.fromEntries(compatibilityFields.map(field => [field, nullableChoice(compatibility)])),
    required: compatibilityFields,
    additionalProperties: false,
  },
}

function readChoice<T extends string>(value: unknown, options: readonly T[]) {
  return options.find(option => value === option)
}

export function readIntakeDetails(input: unknown, today = new Date()): IntakeDetails {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new DraftRequestError('I couldn’t read animal details from that image.')
  }
  const value = input as Record<string, unknown>
  const detail: IntakeDetails = {}
  for (const field of Object.keys(textLimits) as (keyof typeof textLimits)[]) {
    const raw = value[field]
    if (typeof raw === 'string' && raw.trim()) detail[field] = raw.trim().slice(0, textLimits[field])
  }
  if (detail.name && !/^[\p{L}\p{N}][\p{L}\p{N} .’'&()-]*$/u.test(detail.name)) {
    delete detail.name
  }

  const petSpecies = readChoice(value.species, species)
  const sex = readChoice(value.sex, sexes)
  const ageGroup = readChoice(value.ageGroup, ageGroups)
  const size = readChoice(value.size, sizes)
  const status = readChoice(value.status, statuses)
  if (petSpecies) detail.species = petSpecies
  if (sex) detail.sex = sex
  if (ageGroup) detail.ageGroup = ageGroup
  if (size) detail.size = size
  if (status) detail.status = status

  const date = value.estimatedBirthDate
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const day = new Date(date)
    if (!isNaN(day.getTime()) && day <= today && day.toISOString().slice(0, 10) === date) {
      detail.estimatedBirthDate = date
      detail.ageGroup ??= animalAgeGroupAtBirthDate(day, today)
    }
  }
  const weight = value.weight
  if (typeof weight === 'number' && Number.isFinite(weight) && weight > 0) detail.weight = weight
  if (Array.isArray(value.colors)) {
    const colors = [...new Set(value.colors.filter(isAnimalColor))]
    if (colors.length) detail.colors = colors
  }
  if (value.compatibility && typeof value.compatibility === 'object') {
    const raw = value.compatibility as Record<string, unknown>
    for (const field of compatibilityFields) {
      const assessment = readChoice(raw[field], compatibility)
      if (assessment) (detail.compatibility ??= {})[field] = assessment
    }
  }
  return detail
}
