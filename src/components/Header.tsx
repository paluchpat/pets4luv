'use client'

import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type Ref } from 'react'

const navigation = [
  { href: '/', label: 'Home' },
  { href: '/animals', label: 'Adopt' },
  {
    label: 'Information',
    children: [
      { href: '/info/adoption', label: 'About adoptions' },
      { href: '/info/volunteering', label: 'Volunteer' },
      { href: '/applications', label: 'Forms and applications' },
      { href: '/tnr', label: 'Trap, Neuter, Return (TNR)' },
      { href: '/medical', label: 'Medical assistance' },
      { href: '/injured-feral-cats', label: 'Injured feral cats' },
    ],
  },
  { href: '/about', label: 'About us' },
  { href: '/contact', label: 'Contact' },
] as const

type NavigationVariant = 'desktop' | 'mobile'

function isHoverPointer(pointerType: string) {
  return pointerType === 'mouse' || pointerType === 'pen'
}

function InformationMenu({
  variant,
  pathname,
  label,
  links,
  onLinkClick,
}: {
  variant: NavigationVariant
  pathname: string
  label: string
  links: ReadonlyArray<{ href: string; label: string }>
  onLinkClick?: () => void
}) {
  const [openedBy, setOpenedBy] = useState<'hover' | 'activation' | null>(null)
  const group = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const listId = `${variant}-information-links`
  const open = openedBy !== null
  const isCurrent = links.some(link => pathname === link.href)

  useEffect(() => { setOpenedBy(null) }, [pathname])

  useEffect(() => {
    if (!open || variant !== 'desktop') return

    function closeOnOutsidePress(event: PointerEvent) {
      if (event.target instanceof Node && !group.current?.contains(event.target)) {
        setOpenedBy(null)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return

      if (group.current?.contains(document.activeElement)) {
        button.current?.focus()
      }
      setOpenedBy(null)
    }

    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, variant])

  return (
    <div
      ref={group}
      className="information-nav"
      onPointerEnter={variant === 'desktop' ? (event) => {
        if (isHoverPointer(event.pointerType) && event.buttons === 0) {
          setOpenedBy(value => value ?? 'hover')
        }
      } : undefined}
      onPointerLeave={variant === 'desktop' ? (event) => {
        if (isHoverPointer(event.pointerType) && !event.currentTarget.querySelector(':focus-visible')) {
          setOpenedBy(value => value === 'hover' ? null : value)
        }
      } : undefined}
      onBlur={(event) => {
        if (variant === 'desktop' && !event.currentTarget.contains(event.relatedTarget)) {
          setOpenedBy(null)
        }
      }}
      onKeyDown={(event) => {
        if (variant === 'mobile' && event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpenedBy(null)
          button.current?.focus()
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className="nav-item"
        aria-expanded={open}
        aria-controls={listId}
        data-current={isCurrent || undefined}
        onClick={(event) => {
          if (openedBy === 'hover' && event.detail > 0 && (
            !(event.nativeEvent instanceof PointerEvent) || isHoverPointer(event.nativeEvent.pointerType)
          )) return

          setOpenedBy(value => value ? null : 'activation')
        }}
      >
        {label}
        {variant === 'mobile' && <ChevronDown aria-hidden="true" />}
      </button>
      <ul id={listId} className="information-links" hidden={!open}>
        {links.map(link => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
              onClick={() => {
                setOpenedBy(null)
                onLinkClick?.()
              }}
            >
              {link.label}
              {variant === 'mobile' && <span aria-hidden="true">→</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function NavigationItems({
  variant,
  pathname,
  firstLink,
  onLinkClick,
}: {
  variant: NavigationVariant
  pathname: string
  firstLink?: Ref<HTMLAnchorElement>
  onLinkClick?: () => void
}) {
  return navigation.map((item, index) => 'children' in item ? (
    <InformationMenu
      key={item.label}
      variant={variant}
      pathname={pathname}
      label={item.label}
      links={item.children}
      onLinkClick={onLinkClick}
    />
  ) : (
    <Link
      ref={index === 0 ? firstLink : undefined}
      key={item.href}
      className="nav-item"
      href={item.href}
      aria-current={pathname === item.href ? 'page' : undefined}
      onClick={onLinkClick}
    >
      {item.label}
      {variant === 'mobile' && <span aria-hidden="true">→</span>}
    </Link>
  ))
}

export function Header() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const menuButton = useRef<HTMLButtonElement>(null)
  const firstLink = useRef<HTMLAnchorElement>(null)

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => { if (open) firstLink.current?.focus() }, [open])

  return (
    <header className="site-header" onKeyDown={(event) => {
      if (event.key === 'Escape' && open) {
        setOpen(false)
        menuButton.current?.focus()
      }
    }}>
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Pets4Luv home">
          <img src="/images/logo.png" alt="Pets4Luv Foundation" width="200" height="200" />
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <NavigationItems variant="desktop" pathname={pathname} />
        </nav>
        <Link className="button donate-button" href="/donate">Donate</Link>
        <button
          ref={menuButton}
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(value => !value)}
        >
          <span className="menu-lines" aria-hidden="true"><i /><i /><i /></span>
          <span>{open ? 'Close' : 'Menu'}</span>
        </button>
      </div>
      <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation" hidden={!open}>
        {open && <NavigationItems
          variant="mobile"
          pathname={pathname}
          firstLink={firstLink}
          onLinkClick={() => setOpen(false)}
        />}
      </nav>
    </header>
  )
}
