import type { CollectionConfig } from 'payload'
import { adminField, isAdmin } from '../access'
import { isTelegramUserID } from '../lib/catministrator/editors'

const telegramAccess = { read: adminField, create: adminField, update: adminField }

export const Users: CollectionConfig = {
  slug: 'users', auth: {
    tokenExpiration: 7200, maxLoginAttempts: 5, lockTime: 600000,
    cookies: { secure: process.env.VERCEL === '1' && process.env.VERCEL_ENV !== 'development' },
  },
  admin: {
    useAsTitle: 'email', group: false, defaultColumns: ['name', 'email', 'role', 'updatedAt'],
    description: 'Manage website accounts and access. Administrators can add users and assign roles.',
    components: { edit: {
      beforeDocumentControls: ['./components/admin/UserEditor#UserEditorTitle'],
      SaveButton: './components/admin/UserEditor#UserEditorSaveButton',
    } },
  },
  access: {
    admin: ({ req }) => Boolean(req.user && ['admin', 'editor'].includes(String(req.user.role))),
    create: isAdmin,
    read: ({ req }) => req.user?.role === 'admin' ? true : req.user ? { id: { equals: req.user.id } } : false,
    update: ({ req }) => req.user?.role === 'admin' ? true : req.user ? { id: { equals: req.user.id } } : false,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [async ({ data, operation, originalDoc, req }) => {
      if (operation === 'create') {
        // Payload's create-first-user endpoint is the only anonymous bootstrap.
        const existing = await req.payload.count({ collection: 'users', overrideAccess: true, req })
        if (existing.totalDocs === 0) data.role = 'admin'
        else if (req.user?.role !== 'admin') throw new Error('Only an administrator can create staff accounts.')
      }
      if (data.telegramUserId !== undefined && data.telegramUserId !== originalDoc?.telegramUserId) {
        data.telegramLinkedAt = data.telegramUserId ? new Date().toISOString() : null
      } else {
        delete data.telegramLinkedAt
      }
      return data
    }],
  },
  fields: [
    {
      name: 'telegramUserId',
      label: 'Telegram ID',
      type: 'text',
      unique: true,
      access: telegramAccess,
      validate: (value: unknown) => value == null || value === '' || isTelegramUserID(value) || 'Enter the numeric user ID from the bot.',
      hooks: { beforeValidate: [({ value }) => typeof value === 'string' ? value.trim() || null : value] },
      admin: {
        condition: (_data, _siblingData, { user }) => user?.role === 'admin',
        description: 'Ask the user to send /start to the bot and share the ID it returns. Clear this field and save to revoke access.',
      },
    },
    { name: 'name', type: 'text', required: true },
    { name: 'role', type: 'select', required: true, defaultValue: 'editor', options: [{ label: 'Editor', value: 'editor' }, { label: 'Administrator', value: 'admin' }], access: { create: adminField, update: adminField }, admin: { condition: (_data, _siblingData, { user }) => user?.role === 'admin', description: 'Editors update website content. Administrators can also manage users and access.' } },
    { name: 'telegramLinkedAt', type: 'date', access: telegramAccess, admin: { hidden: true } },
  ],
}
