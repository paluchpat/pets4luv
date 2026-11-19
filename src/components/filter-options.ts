import { animalAgeGroups } from '../lib/animal-age'

export const ageOptions = [
  { value: '', label: 'Any age' },
  ...animalAgeGroups.map(({ value, label, range }) => ({ value, label: `${label} (${range})`, shortLabel: label })),
]
export const sizeOptions = [{ value: '', label: 'Any size' }, { value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]
export const genderOptions = [{ value: '', label: 'Any gender' }, { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]
