import type { Payload } from 'payload'
import { defaultWebsiteSettings } from '../src/lib/website-settings'

export async function seedWebsiteSettings(payload: Payload): Promise<boolean> {
  const existing = await payload.findGlobal({ slug: 'website-settings', draft: true, depth: 0 })
  if (existing.id) return false
  await payload.updateGlobal({ slug: 'website-settings', data: { ...defaultWebsiteSettings, _status: 'published' } })
  return true
}
