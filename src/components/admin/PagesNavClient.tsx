'use client'

import { Link, NavGroup, useDocumentEvents } from '@payloadcms/ui'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

type Props = {
  adminRoute: string
  pages: { id: number | string; label: string }[]
  canCreate: boolean
  isOpen?: boolean
}

export function PagesNavClient({ adminRoute, pages, canCreate, isOpen }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { mostRecentUpdate } = useDocumentEvents()

  // Payload reports draft saves, publication, and creation through this provider.
  useEffect(() => {
    if (mostRecentUpdate?.entitySlug === 'pages') router.refresh()
  }, [mostRecentUpdate, router])

  const links = pages.map(page => ({ ...page, href: `${adminRoute}/collections/pages/${page.id}` }))
  if (canCreate) links.push({ id: 'create', label: 'New page', href: `${adminRoute}/collections/pages/create` })

  return <NavGroup label="Pages" isOpen={isOpen}>
    {links.map(({ id, label, href }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`)
      return <Link className="nav__link" href={href} id={`nav-page-${id}`} key={id} prefetch={false} aria-current={active ? 'page' : undefined}>
        {active && <div className="nav__link-indicator" />}
        <span className="nav__link-label">{label}</span>
      </Link>
    })}
  </NavGroup>
}

export function AnimalsNavClient({ adminRoute }: { adminRoute: string }) {
  const pathname = usePathname()
  const href = `${adminRoute}/collections/animals`
  return <Link className="nav__link nav__link--standalone" href={href} id="nav-animals" prefetch={false} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined}>
    <span className="nav__link-label">Animals</span>
  </Link>
}
