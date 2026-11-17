import type { ServerProps } from 'payload'
import { PREFERENCE_KEYS } from 'payload/shared'
import { menuPageLabels, publicPageHref } from '../../lib/main-menu'
import { AnimalsNavClient, PagesNavClient } from './PagesNavClient'

type NavPreferences = { groups?: { Pages?: { open?: boolean } } }

export async function PagesNav({ payload, permissions, user }: ServerProps) {
  if (!user || !['admin', 'editor'].includes(String(user.role)) || !permissions?.collections?.pages?.read) return null

  const [pages, preferences, menu] = await Promise.all([
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
    payload.findGlobal({ slug: 'main-menu', overrideAccess: false, user, draft: false, depth: 0 }),
  ])
  const labels = menuPageLabels(menu)
  const navPreferences = preferences.docs[0]?.value as NavPreferences | undefined
  const links = pages.docs.map(page => {
    return { id: page.id, label: labels.get('page:' + page.id) || labels.get('url:' + publicPageHref(page.slug)) || page.title }
  })

  return <PagesNavClient
    adminRoute={payload.config.routes.admin}
    pages={links}
    canCreate={Boolean(permissions.collections.pages.create)}
    isOpen={navPreferences?.groups?.Pages?.open}
  />
}

/** Direct access to the animal catalog without a redundant Content group. */
export function AnimalsNav({ payload, permissions, user }: ServerProps) {
  if (!user || !['admin', 'editor'].includes(String(user.role)) || !permissions?.collections?.animals?.read) return null
  return <AnimalsNavClient adminRoute={payload.config.routes.admin} />
}
