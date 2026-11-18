import { sharedContentHooks } from '../hooks/shared-content'
import type { CollectionConfig } from 'payload'
import { isStaff, publishedOrStaff, slugField, slugSourceAdmin } from '../access'

const reservedSlugs = new Set(['admin', 'api', 'animals', 'applications', 'info', 'pages', 'media', 'intake-files', 'intakes', 'users', 'knowledge', 'homepage', 'images', 'fonts', 'assets', 'public', 'favicon', 'robots', 'sitemap', 'manifest', 'health'])

export function validatePageSlug(value: unknown): true | string {
  const valid = slugField.validate(value)
  if (valid !== true) return valid
  return reservedSlugs.has(value as string) ? 'This address is reserved by the website. Choose another slug.' : true
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Page', plural: 'Pages' },
  admin: { useAsTitle: 'title', group: false, description: 'Edit public pages, including adoption and volunteering information. Save a draft before publishing changes.' },
  access: { read: publishedOrStaff, create: isStaff, update: isStaff, delete: isStaff, readVersions: isStaff },
  versions: { drafts: { autosave: false }, maxPerDoc: 30 },
  fields: [
    { name: 'title', type: 'text', required: true, admin: slugSourceAdmin },
    { ...slugField, validate: validatePageSlug, admin: { ...slugField.admin, description: 'Filled from the title when blank. Existing slugs stay unchanged. Website route names such as animals and info are reserved.' } },
    { name: 'body', type: 'richText', required: true, hooks: sharedContentHooks, admin: { description: 'Contact details and donation links follow Website settings. Keep shared references such as {{phone}}, {{address}}, and {{emailAddress}} in place; the website displays their current values.' } },
    // Preserve imported article metadata without an obsolete editor control.
    { name: 'category', type: 'select', options: ['adoption', 'volunteering'], admin: { hidden: true } },
    { name: 'source', type: 'text', admin: { hidden: true } },
    { name: 'reviewer', type: 'text', admin: { hidden: true } },
    { name: 'reviewedAt', type: 'date', admin: { hidden: true } },
  ],
}
