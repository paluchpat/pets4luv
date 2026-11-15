import path from 'node:path'
import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'

const uploadRoot = process.env.LOCAL_UPLOAD_DIR || path.resolve(process.cwd(), 'uploads')

export const Media: CollectionConfig = {
  slug: 'media', labels: { singular: 'Approved public photo', plural: 'Approved public photos' },
  admin: { useAsTitle: 'alt', group: 'Content', description: 'Only upload photographs approved for public display. Keep cards and private notes in Intake files.' },
  access: { read: () => true, create: isStaff, update: isStaff, delete: isStaff },
  upload: {
    staticDir: path.resolve(uploadRoot, 'public'), mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    imageSizes: [{ name: 'card', width: 800, height: 800, position: 'centre', formatOptions: { format: 'webp' } }],
    formatOptions: { format: 'webp' }, resizeOptions: { width: 1800, withoutEnlargement: true },
  },
  fields: [{ name: 'alt', type: 'text', required: true }, { name: 'caption', type: 'text' }],
}

export const IntakeFiles: CollectionConfig = {
  slug: 'intake-files', labels: { singular: 'Private intake file', plural: 'Private intake files' },
  admin: { useAsTitle: 'label', group: 'Intake', description: 'Private source photos and information cards. These files require a staff login.' },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  upload: { staticDir: path.resolve(uploadRoot, 'private'), mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], },
  fields: [{ name: 'label', type: 'text', required: true }],
}
