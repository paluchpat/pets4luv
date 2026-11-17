import { Button, Card, Locked } from '@payloadcms/ui'
import { createLocalReq, type ServerProps } from 'payload'
import { getGlobalData } from '@payloadcms/ui/shared'
import { formatAdminURL } from 'payload/shared'
import { AnimalGalleryOverview } from './AnimalGalleryOverview'
import { loadAdminGalleryCards } from './gallery-data'
import { websiteAdminSections } from '../../lib/admin-sections'

/** Website editing sections share their order with the sidebar, including Users under Settings. */
export async function DashboardContent({ payload, permissions, user }: ServerProps) {
  if (!user || !['admin', 'editor'].includes(String(user.role))) return null
  const adminRoute = payload.config.routes.admin
  const [globalData, animals] = await Promise.all([getGlobalData(await createLocalReq({ user }, payload)), permissions?.collections?.animals?.read ? loadAdminGalleryCards(payload, user) : Promise.resolve([])])
  return <div className="collections dashboard-content">
    <div className="collections__wrap">
      {websiteAdminSections.map(section => {
        const entities = section.entities.filter(entity => entity.type === 'collection'
          ? permissions?.collections?.[entity.slug]?.read
          : permissions?.globals?.[entity.slug]?.read)
        if (!entities.length) return null
        if (section.label === 'Animals') return <AnimalGalleryOverview key="animals" cards={animals} canCreate={Boolean(permissions?.collections?.animals?.create)} adminRoute={adminRoute} />
        return <section className="collections__group" key={section.label} aria-labelledby={`dashboard-${section.label.toLowerCase()}-heading`}>
          <h2 className="collections__label" id={`dashboard-${section.label.toLowerCase()}-heading`}>{section.label}</h2>
          <ul className="collections__card-list">
            {entities.map(entity => {
              const path: `/${string}` = entity.type === 'collection' ? `/collections/${entity.slug}` : `/globals/${entity.slug}`
              const lock = entity.type === 'global' ? globalData.find(item => item.slug === entity.slug) : null
              const owner = lock?.data._userEditing
              const activeLock = lock?.data._isLocked && Date.now() < new Date(lock.data._lastEditedAt).getTime() + (lock.lockDuration ?? 300) * 1000
              const lockedByOther = activeLock && owner && typeof owner === 'object' && owner.id !== user.id
              return <li key={entity.slug}>
                <Card
                  id={`card-${entity.slug}`} title={entity.label} titleAs="h3"
                  buttonAriaLabel={`${entity.type === 'collection' ? 'Show all' : 'Edit'} ${entity.label.toLowerCase()}`}
                  href={formatAdminURL({ adminRoute, path })}
                  actions={lockedByOther ? <Locked className="collections__locked" user={owner} /> : entity.type === 'collection' && permissions?.collections?.[entity.slug]?.create ? <Button
                    aria-label={`Create new ${entity.singular}`}
                    buttonStyle="icon-label" el="link" icon="plus" iconStyle="with-border" round
                    to={formatAdminURL({ adminRoute, path: `${path}/create` })}
                  /> : undefined}
                />
              </li>
            })}
          </ul>
        </section>
      })}
    </div>
  </div>
}
