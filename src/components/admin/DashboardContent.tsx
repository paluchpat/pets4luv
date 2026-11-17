import Link from 'next/link'
import { ChevronRight, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Gutter, Locked } from '@payloadcms/ui'
import { createLocalReq, type ServerProps } from 'payload'
import { getGlobalData } from '@payloadcms/ui/shared'
import { formatAdminURL } from 'payload/shared'
import { AnimalGalleryOverview } from './AnimalGalleryOverview'
import { loadAdminGalleryCards } from './gallery-data'
import { websiteAdminSections } from '../../lib/admin-sections'
import { menuPageLabels, publicPageHref } from '../../lib/main-menu'

const descriptions: Record<string, string> = {
  'homepage-intro': 'Foundation introduction and donation message',
  homepage: 'Choose the animals featured on the homepage',
  'website-settings': 'Contact details, social links, and donations',
  'main-menu': 'Website navigation and menu links',
  users: 'Website accounts and access',
}

function DashboardLink({ href, label, description, action }: { href: string; label: string; description?: string; action?: ReactNode }) {
  return <li className="cms-dashboard-row">
    <Link className="cms-dashboard-link" href={href}>
      <span className="cms-dashboard-link-text"><span className="cms-dashboard-link-label">{label}</span>{description && <span className="cms-dashboard-link-detail">{description}</span>}</span>
      <ChevronRight aria-hidden="true" />
    </Link>
    {action}
  </li>
}

/** Direct editing links follow the sidebar order, with individual pages visible. */
export async function DashboardContent({ payload, permissions, user }: ServerProps) {
  if (!user || !['admin', 'editor'].includes(String(user.role))) return null
  const adminRoute = payload.config.routes.admin
  const canReadPages = Boolean(permissions?.collections?.pages?.read)
  const [globalData, animals, pages, menu] = await Promise.all([
    getGlobalData(await createLocalReq({ user }, payload)),
    permissions?.collections?.animals?.read ? loadAdminGalleryCards(payload, user) : Promise.resolve([]),
    canReadPages ? payload.find({ collection: 'pages', overrideAccess: false, user, draft: true, pagination: false, depth: 0, select: { title: true, slug: true }, sort: 'title' }) : Promise.resolve(null),
    canReadPages ? payload.findGlobal({ slug: 'main-menu', overrideAccess: false, user, draft: false, depth: 0 }) : Promise.resolve(null),
  ])
  const pageLabels = menuPageLabels(menu)
  return <Gutter className="dashboard"><div className="dashboard-content">
    {websiteAdminSections.map(section => {
      const entities = section.entities.filter(entity => entity.type === 'collection'
        ? permissions?.collections?.[entity.slug]?.read
        : permissions?.globals?.[entity.slug]?.read)
      if (!entities.length) return null
      if (section.label === 'Animals') return <AnimalGalleryOverview key="animals" cards={animals} canCreate={Boolean(permissions?.collections?.animals?.create)} adminRoute={adminRoute} />
      const isPages = section.label === 'Pages'
      return <section className="cms-dashboard-section" key={section.label} aria-labelledby={`dashboard-${section.label.toLowerCase()}-heading`}>
        <div className="cms-dashboard-section-heading">
          <h2 id={`dashboard-${section.label.toLowerCase()}-heading`}>{section.label}</h2>
          {isPages && permissions?.collections?.pages?.create && <Link className="cms-dashboard-action" href={formatAdminURL({ adminRoute, path: '/collections/pages/create' })}><Plus aria-hidden="true" />New page</Link>}
        </div>
        <ul className="cms-dashboard-links">
          {isPages ? pages?.docs.map(page => <DashboardLink key={page.id}
            href={formatAdminURL({ adminRoute, path: `/collections/pages/${page.id}` })}
            label={pageLabels.get('page:' + page.id) || pageLabels.get('url:' + publicPageHref(page.slug)) || page.title}
          />) : entities.map(entity => {
            const path: `/${string}` = entity.type === 'collection' ? `/collections/${entity.slug}` : `/globals/${entity.slug}`
            const lock = entity.type === 'global' ? globalData.find(item => item.slug === entity.slug) : null
            const owner = lock?.data._userEditing
            const activeLock = lock?.data._isLocked && Date.now() < new Date(lock.data._lastEditedAt).getTime() + (lock.lockDuration ?? 300) * 1000
            const lockedByOther = activeLock && owner && typeof owner === 'object' && owner.id !== user.id
            return <DashboardLink key={entity.slug} href={formatAdminURL({ adminRoute, path })} label={entity.label} description={descriptions[entity.slug]} action={lockedByOther
              ? <Locked className="cms-dashboard-locked" user={owner} />
              : entity.type === 'collection' && permissions?.collections?.[entity.slug]?.create
                ? <Link className="cms-dashboard-action" href={formatAdminURL({ adminRoute, path: `${path}/create` })}><Plus aria-hidden="true" />Add {entity.singular}</Link>
                : undefined}
            />
          })}
        </ul>
        {isPages && !pages?.docs.length && <p className="cms-dashboard-empty">No pages yet.</p>}
      </section>
    })}
  </div></Gutter>
}
