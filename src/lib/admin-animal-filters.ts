import type { Where } from 'payload'
import { animalColorOptions } from './animal-colors'

const compatibilityOptions = [
  { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
  { value: 'conditional', label: 'With conditions' }, { value: 'unknown', label: 'Not assessed' },
]

type AnimalFilter = {
  field: string
  label: string
  empty: string
  operator?: 'contains'
  options: ReadonlyArray<{ value: string; label: string }>
}

export const adminAnimalFilters: AnimalFilter[] = [
  { field: 'status', label: 'Adoption status', empty: 'Any status', options: [
    { value: 'available', label: 'Available' }, { value: 'on-hold', label: 'On hold' }, { value: 'adopted', label: 'Adopted' },
  ] },
  { field: '_status', label: 'Publication', empty: 'Any publication status', options: [
    { value: 'published', label: 'Published' }, { value: 'draft', label: 'Drafts & unpublished changes' },
  ] },
  { field: 'ageGroup', label: 'Age', empty: 'Any age', options: [
    { value: 'baby', label: 'Baby' }, { value: 'young', label: 'Young' },
    { value: 'adult', label: 'Adult' }, { value: 'senior', label: 'Senior' },
  ] },
  { field: 'sex', label: 'Gender', empty: 'Any gender', options: [
    { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'unknown', label: 'Unknown' },
  ] },
  { field: 'colors', label: 'Color', empty: 'Any color', operator: 'contains', options: animalColorOptions },
  { field: 'size', label: 'Size', empty: 'Any size', options: [
    { value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' },
  ] },
  { field: 'compatibility.dogs', label: 'Friendly with dogs', empty: 'Any assessment', options: compatibilityOptions },
  { field: 'compatibility.cats', label: 'Friendly with cats', empty: 'Any assessment', options: compatibilityOptions },
  { field: 'compatibility.children', label: 'Friendly with children', empty: 'Any assessment', options: compatibilityOptions },
]

export function adminAnimalFilterValue(where: Where | undefined, field: string, operator: 'equals' | 'contains' = 'equals'): string {
  const condition = where?.[field]
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return ''
  const value = condition[operator]
  return typeof value === 'string' ? value : ''
}

/** Retain other criteria while changing one control in Payload's server query. */
export function updateAdminAnimalFilter(where: Where | undefined, field: string, value: string, operator: 'equals' | 'contains' = 'equals'): Where {
  const next = { ...where }
  delete next[field]
  if (value) next[field] = operator === 'contains' ? { contains: value } : { equals: value }
  return next
}
