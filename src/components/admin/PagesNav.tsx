import type { ServerProps } from 'payload'
import { PREFERENCE_KEYS } from 'payload/shared'
import { siteLinks } from '../../lib/site-navigation'
import { PagesNavClient } from './PagesNavClient'

type NavPreferences = { groups?: { Pages?: { open?: boolean } } }

export async function PagesNav({ payload, permissions, user }: ServerProps) {
  if (!user || !['admin', 'editor'].includes(String(user.role)) || !permissions?.collections?.pages?.read) return null

  const [pages, preferences] = await Promise.all([
    payload.find({
      collection: 'pages', overrideAccess: false, user, draft: true, pagination: false, depth: 0,
      select: { title: true, slug: true }, sort: 'title',
    }),
    payload.find({
      collection: 'payload-preferences', overrideAccess: false, user, depth: 0, limit: 1,
      select: { value: true },
      where: { and: [
        { key: { equals: PREFERENCE_KEYS.NAV } },
        { 'user.relationTo': { equals: user.collection } },
        { 'user.value': { equals: user.id } },
      ] },
    }),
  ])
  const navPreferences = preferences.docs[0]?.value as NavPreferences | undefined
  const links = pages.docs.map(page => {
    const menuLink = Object.values(siteLinks).find(link => link.href === `/${page.slug}` || link.href === `/info/${page.slug}`)
    return { id: page.id, label: menuLink?.label || page.title }
  })

  return <PagesNavClient
    adminRoute={payload.config.routes.admin}
    pages={links}
    canCreate={Boolean(permissions.collections.pages.create)}
    isOpen={navPreferences?.groups?.Pages?.open}
  />
}
