import type { CollectionConfig, Field } from 'payload'
import { isStaff, publishedOrStaff, slugField } from '../access'

const compatibility = (name: string, label: string): Field => ({
  name, label, type: 'select', required: true, defaultValue: 'unknown', options: ['yes', 'no', 'unknown', 'conditional'],
})

export const Animals: CollectionConfig = {
  slug: 'animals', admin: { useAsTitle: 'name', group: 'Content', defaultColumns: ['name', 'species', 'status', '_status'] },
  access: { read: publishedOrStaff, create: isStaff, update: isStaff, delete: isStaff, readVersions: isStaff },
  versions: { drafts: { autosave: false }, maxPerDoc: 30 },
  fields: [
    { name: 'name', type: 'text', required: true }, slugField,
    { name: 'rescueIntakeID', label: 'Rescue intake ID', type: 'text', unique: true, index: true, access: { read: ({ req }) => Boolean(req.user) } },
    { name: 'species', type: 'select', required: true, options: ['cat', 'dog'] },
    { name: 'status', label: 'Adoption status', type: 'select', required: true, defaultValue: 'available', options: [{ label: 'Available', value: 'available' }, { label: 'On hold', value: 'on-hold' }, { label: 'Adopted', value: 'adopted' }] },
    { name: 'sex', type: 'select', required: true, defaultValue: 'unknown', options: ['female', 'male', 'unknown'] },
    { name: 'breed', label: 'Reported breed (optional)', type: 'text' },
    { name: 'ageGroup', type: 'select', required: true, options: ['baby', 'young', 'adult', 'senior'] },
    { name: 'estimatedBirthDate', type: 'date', admin: { description: 'An estimate, not a confirmed birth date. Age display advances from this date.' } },
    { name: 'ageEstimateReferenceDate', type: 'date' },
    { name: 'size', type: 'select', required: true, options: ['small', 'medium', 'large'] },
    { name: 'weight', type: 'number', min: 0, label: 'Weight (lb)' },
    { name: 'energyLevel', type: 'select', defaultValue: 'unknown', options: ['low', 'moderate', 'high', 'unknown'] },
    { name: 'summary', type: 'textarea', required: true, maxLength: 220 },
    { name: 'description', type: 'textarea', required: true },
    { name: 'careNeeds', type: 'textarea', label: 'Public care needs' },
    { name: 'photos', type: 'array', required: true, minRows: 1, fields: [{ name: 'photo', type: 'upload', relationTo: 'media', required: true }] },
    { name: 'compatibility', type: 'group', fields: [compatibility('dogs', 'With dogs'), compatibility('cats', 'With cats'), compatibility('children', 'With children')] },
    { name: 'compatibilityNotes', type: 'textarea' },
    { name: 'internalNotes', type: 'textarea', access: { read: ({ req }) => Boolean(req.user) }, admin: { description: 'Private; excluded from all public content.' } },
  ],
}
