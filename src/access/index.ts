import type { Access, FieldAccess, FieldHook } from 'payload'
import { fillEmptySlug } from '../lib/slug'

export const isStaff: Access = ({ req }) => Boolean(req.user && ['admin', 'editor'].includes(String(req.user.role)))
export const isAdmin: Access = ({ req }) => req.user?.role === 'admin'
export const adminField: FieldAccess = ({ req }) => req.user?.role === 'admin'
export const publishedOrStaff: Access = ({ req }) => {
  if (req.user && ['admin', 'editor'].includes(String(req.user.role))) return true
  return { _status: { equals: 'published' } }
}

const populateSlug: FieldHook = ({ value, siblingData, originalDoc, collection }) => {
  const source = collection?.admin?.useAsTitle || 'title'
  return fillEmptySlug(value, siblingData?.[source] ?? originalDoc?.[source])
}

export const slugSourceAdmin = {
  components: { Field: './components/admin/SlugSourceField#SlugSourceField' },
}

export const slugField = {
  name: 'slug', type: 'text' as const, required: true, unique: true, index: true,
  hooks: { beforeValidate: [populateSlug] },
  admin: { description: 'Filled from the title or name when blank. Existing slugs stay unchanged.' },
  validate: (value: unknown) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
    ? true : 'Use lowercase letters, numbers, and single hyphens.',
}
