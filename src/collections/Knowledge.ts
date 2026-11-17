import type { CollectionConfig } from 'payload'
import { isStaff, publishedOrStaff, slugField } from '../access'

export const Knowledge: CollectionConfig = {
  slug: 'knowledge', labels: { singular: 'Information article', plural: 'Adoption & volunteering' },
  admin: { useAsTitle: 'title', group: 'Content', hidden: true },
  access: { read: publishedOrStaff, create: isStaff, update: isStaff, delete: isStaff, readVersions: isStaff },
  versions: { drafts: { autosave: false }, maxPerDoc: 30 },
  fields: [
    { name: 'title', type: 'text', required: true }, slugField,
    { name: 'category', type: 'select', required: true, options: ['adoption', 'volunteering'] },
    { name: 'body', type: 'richText', required: true },
    { name: 'source', type: 'text' },
    { name: 'reviewer', type: 'text' },
    { name: 'reviewedAt', type: 'date' },
  ],
}
