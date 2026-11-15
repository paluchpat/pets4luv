import type { Access, FieldAccess } from 'payload'

export const isStaff: Access = ({ req }) => Boolean(req.user && ['admin', 'editor'].includes(String(req.user.role)))
export const isAdmin: Access = ({ req }) => req.user?.role === 'admin'
export const adminField: FieldAccess = ({ req }) => req.user?.role === 'admin'
export const publishedOrStaff: Access = ({ req }) => {
  if (req.user && ['admin', 'editor'].includes(String(req.user.role))) return true
  return { _status: { equals: 'published' } }
}

export const slugField = {
  name: 'slug', type: 'text' as const, required: true, unique: true, index: true,
  validate: (value: unknown) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
    ? true : 'Use lowercase letters, numbers, and single hyphens.',
}
