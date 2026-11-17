import type { Payload } from 'payload'
import { defaultMainMenu, menuRecords, publicPageHref } from '../src/lib/main-menu'

/** Preserve the current menu once, then leave all future edits and removals to editors. */
export async function seedMainMenu(payload: Payload): Promise<boolean> {
  const existing = await payload.findGlobal({ slug: 'main-menu', draft: true, depth: 0 })
  if (existing.id) return false
  const pages = await payload.find({ collection: 'pages', draft: false, depth: 0, pagination: false, where: { _status: { equals: 'published' } }, select: { slug: true } })
  const byURL = new Map(pages.docs.map(page => [publicPageHref(page.slug), page.id]))
  const data = structuredClone(defaultMainMenu)
  for (const item of menuRecords(data)) {
    const page = item.linkType === 'custom' && item.url ? byURL.get(item.url) : null
    if (page) {
      item.linkType = 'page'
      item.page = page
      delete item.url
    }
  }
  await payload.updateGlobal({ slug: 'main-menu', data: { ...data, _status: 'published' } as any })
  return true
}
