import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'

export const Intakes: CollectionConfig = {
  slug: 'intakes', admin: { useAsTitle: 'intakeID', group: 'Intake', description: 'Manual workflow: upload both source photos, enter supplied facts, create an animal draft, review its public photos and fields, then publish from Animals. AI is disabled.' },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff, readVersions: isStaff },
  versions: { maxPerDoc: 20 },
  fields: [
    { name: 'intakeID', type: 'text', required: true, unique: true, index: true, admin: { description: 'Use a stable rescue intake ID. Reuse the existing record for retries.' } },
    { name: 'animalPhoto', type: 'upload', relationTo: 'intake-files', required: true },
    { name: 'informationCard', type: 'upload', relationTo: 'intake-files', required: true },
    { name: 'submittedFacts', type: 'textarea', required: true },
    { name: 'sourceReference', type: 'text' },
    { name: 'unresolvedQuestions', type: 'textarea' },
    { name: 'animal', type: 'relationship', relationTo: 'animals', admin: { description: 'Create or select the animal draft after entering the source facts. Only approved photos belong in its public photo library.' } },
    { name: 'state', type: 'select', required: true, defaultValue: 'received', options: ['received', 'manual-review', 'draft-created', 'reviewed', 'complete'] },
    { name: 'internalNotes', type: 'textarea' },
  ],
}
