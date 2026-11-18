export const animalColorOptions = [
  { label: 'Black', value: 'black' },
  { label: 'Brown', value: 'brown' },
  { label: 'Calico', value: 'calico' },
  { label: 'Cream', value: 'cream' },
  { label: 'Gold', value: 'gold' },
  { label: 'Gray', value: 'gray' },
  { label: 'Orange', value: 'orange' },
  { label: 'Red', value: 'red' },
  { label: 'Tan', value: 'tan' },
  { label: 'White', value: 'white' },
] as const

export type AnimalColor = typeof animalColorOptions[number]['value']

export function isAnimalColor(value: unknown): value is AnimalColor {
  return animalColorOptions.some((option) => option.value === value)
}
