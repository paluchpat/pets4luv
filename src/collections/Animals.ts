import { ValidationError, type CollectionConfig, type Field } from 'payload'
import { isStaff, publishedOrStaff, slugField } from '../access'
import { animalColorOptions } from '../lib/animal-colors'
import { adminAnimalSearchFields, expandAdminAnimalSearch } from '../lib/admin-animal-search'

const weightMessage = 'Enter a number of pounds, including decimals, or leave this blank.'
function validWeightInput(value: unknown): boolean {
  if (value == null || value === '') return true
  if (typeof value === 'string' && !/^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return false
  return (typeof value === 'number' || typeof value === 'string') && Number.isFinite(Number(value)) && Number(value) >= 0
}

const compatibility = (name: string, label: string): Field => ({
  name, label, type: 'select', required: true, defaultValue: 'unknown', options: ['yes', 'no', 'unknown', 'conditional'],
})

export const Animals: CollectionConfig = {
  slug: 'animals', admin: { useAsTitle: 'name', group: false, defaultColumns: ['name', 'species', 'status', '_status'], pagination: { defaultLimit: 12, limits: [12, 24, 48] }, listSearchableFields: adminAnimalSearchFields, components: { views: { list: { Component: './components/admin/AnimalGalleryList#AnimalGalleryList' } } } },
  defaultSort: '-updatedAt',
  access: { read: publishedOrStaff, create: isStaff, update: isStaff, delete: isStaff, readVersions: isStaff },
  versions: { drafts: { autosave: false }, maxPerDoc: 30 },
  hooks: { beforeOperation: [({ args, operation, req }) => {
    // Validate before Payload's number coercion can turn a value such as "12lb" into 12.
    if ('data' in args && args.data && 'weight' in args.data && !validWeightInput(args.data.weight)) {
      throw new ValidationError({ collection: 'animals', errors: [{ path: 'weight', message: weightMessage }] })
    }
    if ((operation === 'read' || operation === 'count') && 'where' in args && req.user && ['admin', 'editor'].includes(String(req.user.role))) {
      args.where = expandAdminAnimalSearch(args.where)
    }
    return args
  }] },
  fields: [
    { type: 'tabs', tabs: [
      { label: 'Details', fields: [
        { name: 'name', type: 'text', required: true }, slugField,
        { name: 'species', type: 'select', required: true, options: ['cat', 'dog'] },
        { name: 'status', label: 'Adoption status', type: 'select', required: true, defaultValue: 'available', options: [{ label: 'Available', value: 'available' }, { label: 'Pending', value: 'on-hold' }, { label: 'Adopted', value: 'adopted' }] },
        { name: 'sex', label: 'Gender', type: 'select', required: true, defaultValue: 'unknown', options: ['female', 'male', 'unknown'] },
        { name: 'ageGroup', type: 'select', required: true, options: ['baby', 'young', 'adult', 'senior'] },
        { name: 'size', type: 'select', required: true, options: ['small', 'medium', 'large'] },
        { name: 'rescueIntakeID', label: 'Rescue intake ID', type: 'text', unique: true, index: true, access: { read: ({ req }) => Boolean(req.user) } },
        { name: 'breed', label: 'Reported breed', type: 'text' },
        { name: 'colors', label: 'Color', type: 'select', hasMany: true, options: [...animalColorOptions] },
        { name: 'estimatedBirthDate', type: 'date', admin: { description: 'An estimate, not a confirmed birth date. Age display advances from this date.' } },
        { name: 'weight', type: 'number', min: 0, label: 'Weight (lb)', validate: (value: unknown) => validWeightInput(value) ? true : weightMessage, admin: { components: { Field: './components/admin/WeightField#WeightField' }, step: 0.1, description: 'Accepts decimals and appears on the animal’s website profile only when provided.' } },
      ] },
      { label: 'Photos', fields: [
        { name: 'photos', type: 'array', required: true, minRows: 1, labels: { singular: 'Photo', plural: 'Photos' }, admin: { className: 'cms-animal-photos', description: 'The first photo is the main image on the website. Drag photos to change their order.' }, fields: [{ name: 'photo', type: 'upload', relationTo: 'media', required: true, admin: { className: 'cms-animal-photo-upload', components: { beforeInput: ['./components/admin/PhotoUploadControls#PhotoUploadControls'] } } }] },
      ] },
      { label: 'Story', fields: [
        { name: 'description', type: 'textarea', required: true },
        {
          name: 'summary', label: 'Summary', type: 'textarea', maxLength: 220, defaultValue: '',
          // Preserve compatibility with existing animal and draft storage.
          hooks: { beforeValidate: [({ value }) => value ?? ''] },
        },
        { name: 'careNeeds', type: 'textarea', label: 'Public care needs' },
      ] },
      { label: 'Friendly with', fields: [
        { name: 'compatibility', type: 'group', fields: [compatibility('dogs', 'With dogs'), compatibility('cats', 'With cats'), compatibility('children', 'With children')] },
        { name: 'compatibilityNotes', type: 'textarea' },
      ] },
      { label: 'Editor notes', fields: [
        { name: 'internalNotes', type: 'textarea', access: { read: ({ req }) => Boolean(req.user) }, admin: { description: 'Private; excluded from all public content.' } },
      ] },
    ] },
    // Retired controls: preserve legacy values without exposing them in the editor.
    { name: 'ageEstimateReferenceDate', type: 'date', admin: { hidden: true } },
    { name: 'energyLevel', type: 'select', defaultValue: 'unknown', options: ['low', 'moderate', 'high', 'unknown'], admin: { hidden: true } },
  ],
}
