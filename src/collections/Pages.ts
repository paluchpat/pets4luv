import type { CollectionConfig } from 'payload'
import { isStaff, publishedOrStaff, slugField } from '../access'

const reservedSlugs = new Set(['admin', 'api', 'animals', 'info', 'pages', 'media', 'intake-files', 'intakes', 'users', 'knowledge', 'homepage', 'images', 'fonts', 'assets', 'public', 'favicon', 'robots', 'sitemap', 'manifest', 'health'])

export function validatePageSlug(value: unknown): true | string {
  const valid = slugField.validate(value)
  if (valid !== true) return valid
  return reservedSlugs.has(value as string) ? 'This address is reserved by the website. Choose another slug.' : true
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title', group: 'Content', description: 'Edit standalone public pages such as Donate and Contact. Save a draft before publishing changes.' },
  access: { read: publishedOrStaff, create: isStaff, update: isStaff, delete: isStaff, readVersions: isStaff },
  versions: { drafts: { autosave: false }, maxPerDoc: 30 },
  fields: [
    { name: 'title', type: 'text', required: true },
    { ...slugField, validate: validatePageSlug, admin: { description: 'A single lowercase address, for example donate. Website route names such as animals and info are reserved.' } },
    { name: 'body', type: 'richText', required: true },
  ],
}
