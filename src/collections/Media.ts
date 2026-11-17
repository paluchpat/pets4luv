import path from 'node:path'
import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'

const uploadRoot = process.env.LOCAL_UPLOAD_DIR || path.resolve(process.cwd(), 'uploads')

export const Media: CollectionConfig = {
  slug: 'media', labels: { singular: 'Approved public photo', plural: 'Approved public photos' },
  admin: {
    useAsTitle: 'alt', hidden: true,
    description: 'Choose a photo, or upload a new one. Only upload photographs approved for public display.',
    defaultColumns: ['filename', 'alt', 'updatedAt'], listSearchableFields: ['alt', 'caption', 'filename'],
    pagination: { defaultLimit: 20, limits: [10, 20, 40] },
  },
  defaultSort: '-updatedAt',
  access: { read: () => true, create: isStaff, update: isStaff, delete: isStaff },
  upload: {
    pasteURL: false,
    staticDir: path.resolve(uploadRoot, 'public'), mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    // Use the original image so portrait and landscape previews remain uncropped.
    adminThumbnail: ({ doc }) => typeof doc.url === 'string' && doc.url ? doc.url
      : typeof doc.filename === 'string' ? `/api/media/file/${encodeURIComponent(doc.filename)}` : null,
    imageSizes: [{ name: 'card', width: 800, height: 800, position: 'centre', formatOptions: { format: 'webp' } }],
    formatOptions: { format: 'webp' }, resizeOptions: { width: 1800, withoutEnlargement: true },
  },
  fields: [
    {
      name: 'alt', label: 'Photo description (optional)', type: 'text', defaultValue: '',
      // Existing photo databases require a string; an empty description stays valid.
      hooks: { beforeValidate: [({ value }) => value ?? ''] },
      admin: { description: 'Alt text is a short description of the photo for people who use screen readers. Example: Poppy resting in a basket.' },
    },
    { name: 'caption', type: 'text' },
    // Payload merges this label into its existing read-only filename field.
    { name: 'filename', label: 'Photo', type: 'text' },
  ],
}

export const IntakeFiles: CollectionConfig = {
  slug: 'intake-files', labels: { singular: 'Private intake file', plural: 'Private intake files' },
  admin: { useAsTitle: 'label', hidden: true, description: 'Retired private-file storage. No longer used by the website editor.' },
  // Keep archived files inaccessible; approved animal photos use the separate media collection.
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  upload: { staticDir: path.resolve(uploadRoot, 'private'), mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], },
  fields: [{ name: 'label', type: 'text', required: true }],
}
