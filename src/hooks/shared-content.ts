import type { FieldHook, PayloadRequest } from 'payload'
import { createWebsiteSettingsReferences } from '../lib/website-settings'

// Reuse one settings lookup for every article/field read in the same request.
const references = new WeakMap<PayloadRequest, Promise<ReturnType<typeof createWebsiteSettingsReferences>>>()

const sharedContent: FieldHook = async ({ value, req }) => {
  if (value == null || value === '') return value
  let pending = references.get(req)
  if (!pending) {
    pending = Promise.all([
      req.payload.findGlobal({ slug: 'website-settings', overrideAccess: true, draft: true, depth: 0, req }),
      req.payload.findGlobalVersions({ slug: 'website-settings', overrideAccess: true, depth: 0, limit: 30, sort: '-updatedAt', req }),
    ]).then(([current, revisions]) => createWebsiteSettingsReferences([current, ...revisions.docs.map(row => row.version)]))
    references.set(req, pending)
  }
  return (await pending)(value)
}

/** Present shared references in the editor, and persist them whenever content is saved. */
export const sharedContentHooks = { afterRead: [sharedContent], beforeValidate: [sharedContent] }
