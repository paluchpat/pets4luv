import { sharedContentHooks } from '../hooks/shared-content'
import { ValidationError, type GlobalConfig } from 'payload'
import { isStaff, publishedOrStaff } from '../access'
import { featuredAnimalEligibility, featuredAnimalLimit } from '../lib/featured-animals'
import { draftEditorControls } from '../lib/draft-editor-controls'

export const Homepage: GlobalConfig = {
  slug: 'homepage', label: 'Featured animals',
  access: { read: publishedOrStaff, update: isStaff, readVersions: isStaff },
  versions: { drafts: { autosave: false }, max: 30 },
  hooks: { beforeValidate: [({ data, req }) => {
    if (Array.isArray(data?.featuredAnimals) && data.featuredAnimals.length > featuredAnimalLimit) {
      throw new ValidationError({ global: 'homepage', req, errors: [{ path: 'featuredAnimals', message: 'Choose up to three animals.' }] })
    }
    return data
  }] },
  admin: {
    group: false,
    description: 'Edit the introduction, choose up to three available animals, set their homepage order, save a draft and preview before publishing.',
    preview: () => '/api/preview?path=/',
    livePreview: { url: '/api/preview?path=/' },
    components: { elements: draftEditorControls('Publish featured animals') },
  },
  fields: [
    { name: 'heading', type: 'text', required: true, defaultValue: 'The best part of their story is still ahead.' },
    { name: 'intro', type: 'richText', required: true, hooks: sharedContentHooks },
    {
      name: 'featuredAnimals',
      label: 'Featured animals',
      type: 'array',
      maxRows: featuredAnimalLimit,
      fields: [{ name: 'animal', type: 'relationship', relationTo: 'animals', required: true, filterOptions: featuredAnimalEligibility }],
      admin: { components: { Field: './components/admin/FeaturedAnimalsField#FeaturedAnimalsField' } },
    },
  ],
}
