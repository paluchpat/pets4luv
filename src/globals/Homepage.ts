import type { GlobalConfig } from 'payload'
import { isStaff, publishedOrStaff } from '../access'

export const Homepage: GlobalConfig = {
  slug: 'homepage', label: 'Homepage Highlights',
  access: { read: publishedOrStaff, update: isStaff, readVersions: isStaff },
  versions: { drafts: { autosave: false }, max: 30 },
  admin: { group: 'Homepage', description: 'Edit the introduction, choose available animals, drag rows to arrange them, save a draft and preview before publishing.', preview: () => '/api/preview?path=/', livePreview: { url: '/api/preview?path=/' } },
  fields: [
    { name: 'heading', type: 'text', required: true, defaultValue: 'The best part of their story is still ahead.' },
    { name: 'intro', type: 'richText', required: true },
    { name: 'featuredAnimals', type: 'array', maxRows: 6, fields: [{ name: 'animal', type: 'relationship', relationTo: 'animals', required: true, filterOptions: { and: [{ status: { equals: 'available' } }, { _status: { equals: 'published' } }] } }], admin: { description: 'Only your selected, published, available animals appear. Unavailable selections are hidden without substitutes.' } },
  ],
}
