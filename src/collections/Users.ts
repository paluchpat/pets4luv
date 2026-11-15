import type { CollectionConfig } from 'payload'
import { adminField, isAdmin, isStaff } from '../access'

export const Users: CollectionConfig = {
  slug: 'users', auth: {
    tokenExpiration: 7200, maxLoginAttempts: 5, lockTime: 600000,
    cookies: { secure: process.env.VERCEL === '1' && process.env.VERCEL_ENV !== 'development' },
  },
  admin: { useAsTitle: 'email', group: 'Administration' },
  access: {
    admin: ({ req }) => Boolean(req.user && ['admin', 'editor'].includes(String(req.user.role))),
    create: isAdmin,
    read: ({ req }) => req.user?.role === 'admin' ? true : req.user ? { id: { equals: req.user.id } } : false,
    update: ({ req }) => req.user?.role === 'admin' ? true : req.user ? { id: { equals: req.user.id } } : false,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [async ({ data, operation, req }) => {
      if (operation === 'create') {
        // Payload's create-first-user endpoint is the only anonymous bootstrap.
        const existing = await req.payload.count({ collection: 'users', overrideAccess: true, req })
        if (existing.totalDocs === 0) data.role = 'admin'
        else if (req.user?.role !== 'admin') throw new Error('Only an administrator can create staff accounts.')
      }
      return data
    }],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'role', type: 'select', required: true, defaultValue: 'editor', options: ['admin', 'editor'], access: { create: adminField, update: adminField }, admin: { condition: (_data, _siblingData, { user }) => user?.role === 'admin', description: 'Only administrators can assign roles. The first account is automatically an administrator.' } },
  ],
}
