import type { Payload } from 'payload'
import { defaultHomepageIntro } from '../src/lib/homepage-intro'

/** Initialize only an absent global; preserve published content and pending drafts. */
export async function seedHomepageIntro(payload: Payload): Promise<boolean> {
  const existing = await payload.findGlobal({ slug: 'homepage-intro', draft: true, depth: 0 })
  if (existing.id) return false
  await payload.updateGlobal({ slug: 'homepage-intro', data: { ...defaultHomepageIntro, _status: 'published' } })
  return true
}
