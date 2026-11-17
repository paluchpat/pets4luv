import type { Payload } from 'payload'
import { defaultWebsiteSettings, websiteSettingKeys, type StoredWebsiteSettings } from '../src/lib/website-settings'

export async function seedWebsiteSettings(payload: Payload): Promise<boolean> {
  const existing = await payload.findGlobal({ slug: 'website-settings', draft: true, depth: 0 })
  if (existing.id) return false
  const defaults = Object.fromEntries(websiteSettingKeys.map(key => [key, defaultWebsiteSettings[key]])) as StoredWebsiteSettings
  await payload.updateGlobal({ slug: 'website-settings', data: { ...defaults, _status: 'published' } })
  return true
}
