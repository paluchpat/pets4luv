import { Button, Card } from '@payloadcms/ui'
import type { ServerProps } from 'payload'
import { formatAdminURL } from 'payload/shared'

const collections = [
  { slug: 'animals', label: 'Animals', singular: 'animal' },
  { slug: 'pages', label: 'Pages', singular: 'page' },
] as const

/** These collections use custom sidebar links, so Payload omits their default dashboard cards. */
export function DashboardContent({ payload, permissions, user }: ServerProps) {
  if (!user || !['admin', 'editor'].includes(String(user.role))) return null
  const visible = collections.filter(({ slug }) => permissions?.collections?.[slug]?.read)
  if (!visible.length) return null
  const adminRoute = payload.config.routes.admin

  return <div className="collections dashboard-content">
    <div className="collections__wrap">
      <section className="collections__group" aria-labelledby="dashboard-content-heading">
        <h2 className="collections__label" id="dashboard-content-heading">Content</h2>
        <ul className="collections__card-list">
          {visible.map(({ slug, label, singular }) => <li key={slug}>
            <Card
              id={`card-${slug}`}
              title={label}
              titleAs="h3"
              buttonAriaLabel={`Show all ${label.toLowerCase()}`}
              href={formatAdminURL({ adminRoute, path: `/collections/${slug}` })}
              actions={permissions?.collections?.[slug]?.create ? <Button
                aria-label={`Create new ${singular}`}
                buttonStyle="icon-label" el="link" icon="plus" iconStyle="with-border" round
                to={formatAdminURL({ adminRoute, path: `/collections/${slug}/create` })}
              /> : undefined}
            />
          </li>)}
        </ul>
      </section>
    </div>
  </div>
}
