import { sharedContentHooks } from '../hooks/shared-content'
import type { GlobalConfig } from 'payload'
import { isStaff, publishedOrStaff } from '../access'

export const Homepage: GlobalConfig = {
  slug: 'homepage', label: 'Featured Animals',
  access: { read: publishedOrStaff, update: isStaff, readVersions: isStaff },
  versions: { drafts: { autosave: false }, max: 30 },
  admin: { group: false, description: 'Edit the introduction, choose available animals, drag rows to arrange them, save a draft and preview before publishing.', preview: () => '/api/preview?path=/', livePreview: { url: '/api/preview?path=/' } },
  fields: [
    { name: 'heading', type: 'text', required: true, defaultValue: 'The best part of their story is still ahead.' },
    { name: 'intro', type: 'richText', required: true, hooks: sharedContentHooks },
    { name: 'featuredAnimals', type: 'array', labels: { singular: 'row', plural: 'rows' }, maxRows: 6, fields: [{ name: 'animal', type: 'relationship', relationTo: 'animals', required: true, filterOptions: { and: [{ status: { equals: 'available' } }, { _status: { equals: 'published' } }] } }], admin: { components: { RowLabel: './components/admin/ArrayRowLabel#ArrayRowLabel' }, description: 'Only your selected, published, available animals appear. Unavailable selections are hidden without substitutes.' } },
  ],
}
