'use client'

import { FieldError, FieldLabel, ReactSelect, useField, useFormFields } from '@payloadcms/ui'
import type { TextFieldClientProps } from 'payload'
import { useId } from 'react'

const optionFor = (name: string) => ({ label: name, value: name })
const catBreeds = [
  'Domestic shorthair',
  'Domestic medium hair',
  'Domestic longhair',
  'American Shorthair',
  'Bengal',
  'British Shorthair',
  'Maine Coon',
  'Persian',
  'Ragdoll',
  'Russian Blue',
  'Siamese',
  'Siberian',
].map(optionFor)
const dogBreeds = [
  'Mixed breed',
  'American Pit Bull Terrier',
  'American Staffordshire Terrier',
  'Australian Shepherd',
  'Beagle',
  'Boxer',
  'Bulldog',
  'Chihuahua',
  'Dachshund',
  'French Bulldog',
  'German Shepherd',
  'German Shorthaired Pointer',
  'Golden Retriever',
  'Labrador Retriever',
  'Poodle',
  'Rottweiler',
  'Shih Tzu',
  'Siberian Husky',
  'Yorkshire Terrier',
].map(optionFor)
const allBreeds = [{ label: 'Cats', options: catBreeds }, { label: 'Dogs', options: dogBreeds }]
const breedKey = (name: string) => name.normalize('NFKC').trim().toLowerCase()

function breedNames(value: string) {
  const breeds = new Map<string, string>()
  for (const part of value.split(',')) {
    const name = part.trim()
    const key = breedKey(name)
    if (name && !breeds.has(key)) breeds.set(key, name)
  }
  return [...breeds.values()]
}

export function ReportedBreedField({ field, path: initialPath, readOnly }: TextFieldClientProps) {
  const { disabled, path, setValue, showError, value } = useField<string | null>({ potentiallyStalePath: initialPath })
  const species = useFormFields(([fields]) => fields.species?.value)
  const inputId = useId()
  const options = species === 'cat' ? catBreeds : species === 'dog' ? dogBreeds : allBreeds

  return <div className="field-type select" id={`field-${path.replaceAll('.', '__')}`}>
    <FieldLabel as="label" htmlFor={inputId} label={field.label} path={path} />
    <div className="field-type__wrap">
      <FieldError path={path} showError={showError} />
      <ReactSelect inputId={inputId} disabled={readOnly || disabled} showError={showError}
        isMulti isCreatable options={options} value={breedNames(value ?? '').map(optionFor)}
        placeholder="Select or type a breed" getOptionValue={option => breedKey(String(option.value))}
        filterOption={(option, query) => Boolean(option && (
          option.data.__isNew__ || breedKey(option.label).includes(breedKey(query))
        ))}
        onChange={selection => {
          // Keep the existing searchable text field for profiles, drafts, and API clients.
          const selected = Array.isArray(selection) ? selection : []
          setValue(breedNames(selected.map(option => option.value).join(', ')).join(', '))
        }} />
    </div>
  </div>
}
