import { sharedContentHooks } from '../hooks/shared-content'
import type { GlobalConfig } from 'payload'
import { isStaff, publishedOrStaff } from '../access'
import { defaultHomepageIntro } from '../lib/homepage-intro'

export const HomepageIntro: GlobalConfig = {
  slug: 'homepage-intro',
  label: 'Intro',
  access: { read: publishedOrStaff, update: isStaff, readVersions: isStaff },
  versions: { drafts: { autosave: false }, max: 30 },
  admin: {
    group: false,
    description: 'Edit the foundation introduction, save a draft and preview before publishing.',
    preview: () => '/api/preview?path=/',
    livePreview: { url: '/api/preview?path=/' },
  },
  fields: [
    { name: 'heading', type: 'text', required: true, defaultValue: defaultHomepageIntro.heading },
    { name: 'body', type: 'richText', required: true, hooks: sharedContentHooks, defaultValue: defaultHomepageIntro.body },
  ],
}
