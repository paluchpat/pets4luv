import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { publicPageHref } from '@/lib/main-menu'
import { publicSiteOrigin } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!publicSiteOrigin) return []

  const payload = await getPayload({ config })
  const published = { _status: { equals: 'published' } }
  const [pages, animals] = await Promise.all([
    payload.find({
      collection: 'pages', draft: false, overrideAccess: false, depth: 0, pagination: false,
      where: published, select: { slug: true, updatedAt: true },
    }),
    payload.find({
      collection: 'animals', draft: false, overrideAccess: false, depth: 0, pagination: false,
      where: published, select: { slug: true, updatedAt: true },
    }),
  ])
  const entries = [
    ...['/', '/animals', '/applications'].map(path => ({ path })),
    ...pages.docs.map(page => ({ path: publicPageHref(page.slug), lastModified: page.updatedAt })),
    ...animals.docs.map(animal => ({ path: `/animals/${animal.slug}`, lastModified: animal.updatedAt })),
  ]
  return entries.map(({ path, ...entry }) => ({ url: new URL(path, publicSiteOrigin).href, ...entry }))
}
