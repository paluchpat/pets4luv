import type { ServerProps } from 'payload'
import { PREFERENCE_KEYS, formatAdminURL } from 'payload/shared'
import { menuPageLabels, publicPageHref } from '../../lib/main-menu'
import { websiteAdminSections } from '../../lib/admin-sections'
import { AdminNavGroup, AnimalsNavClient, PagesNavClient } from './PagesNavClient'

type NavPreferences = { groups?: Record<string, { open?: boolean }> }
type NavProps = ServerProps & { navPreferences?: NavPreferences }

export async function PagesNav({ payload, permissions, user, navPreferences }: NavProps) {
  if (!user || !['admin', 'editor'].includes(String(user.role)) || !permissions?.collections?.pages?.read) return null

  const [pages, preferences, menu] = await Promise.all([
    payload.find({
      collection: 'pages', overrideAccess: false, user, draft: true, pagination: false, depth: 0,
      select: { title: true, slug: true }, sort: 'title',
    }),
    navPreferences ? Promise.resolve(navPreferences) : getNavPreferences({ payload, user }),
    payload.findGlobal({ slug: 'main-menu', overrideAccess: false, user, draft: false, depth: 0 }),
  ])
  const labels = menuPageLabels(menu)
  const links = pages.docs.map(page => {
    return { id: page.id, label: labels.get('page:' + page.id) || labels.get('url:' + publicPageHref(page.slug)) || page.title }
  })

  return <PagesNavClient
    adminRoute={payload.config.routes.admin}
    pages={links}
    canCreate={Boolean(permissions.collections.pages.create)}
    isOpen={preferences.groups?.Pages?.open}
  />
}

/** Direct access to the animal catalog without a redundant Content group. */
export function AnimalsNav({ payload, permissions, user }: ServerProps) {
  if (!user || !['admin', 'editor'].includes(String(user.role)) || !permissions?.collections?.animals?.read) return null
  return <AnimalsNavClient adminRoute={payload.config.routes.admin} />
}

async function getNavPreferences({ payload, user }: Pick<ServerProps, 'payload' | 'user'>): Promise<NavPreferences> {
  if (!user) return {}
  const preferences = await payload.find({
    collection: 'payload-preferences', overrideAccess: false, user, depth: 0, limit: 1,
    select: { value: true },
    where: { and: [
      { key: { equals: PREFERENCE_KEYS.NAV } },
      { 'user.relationTo': { equals: user.collection } },
      { 'user.value': { equals: user.id } },
    ] },
  })
  return (preferences.docs[0]?.value as NavPreferences) || {}
}

/** Render in DOM order so keyboard navigation follows the visible section order. */
export async function WebsiteNav(props: ServerProps) {
  const { payload, permissions, user } = props
  if (!user || !['admin', 'editor'].includes(String(user.role))) return null
  const navPreferences = await getNavPreferences(props)
  const adminRoute = payload.config.routes.admin
  return <>
    {websiteAdminSections.map(section => {
      if (section.label === 'Animals') return <AnimalsNav {...props} key={section.label} />
      if (section.label === 'Pages') return <PagesNav {...props} navPreferences={navPreferences} key={section.label} />
      const links = section.entities.flatMap(entity => {
        if (entity.type !== 'global' || !permissions?.globals?.[entity.slug]?.read) return []
        return [{ id: `nav-global-${entity.slug}`, label: entity.label, href: formatAdminURL({ adminRoute, path: `/globals/${entity.slug}` }) }]
      })
      return links.length ? <AdminNavGroup key={section.label} label={section.label} links={links} isOpen={navPreferences.groups?.[section.label]?.open} /> : null
    })}
  </>
}
