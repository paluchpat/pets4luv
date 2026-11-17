'use client'

import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { MainMenuDTO, MenuItem, MenuLink } from '@/lib/main-menu'

type NavigationVariant = 'desktop' | 'mobile'

function isHoverPointer(pointerType: string) {
  return pointerType === 'mouse' || pointerType === 'pen'
}

function NavigationSubmenu({
  variant,
  pathname,
  label,
  links,
  onLinkClick,
}: {
  variant: NavigationVariant
  pathname: string
  label: string
  links: readonly MenuLink[]
  onLinkClick?: () => void
}) {
  const [openedBy, setOpenedBy] = useState<'hover' | 'activation' | null>(null)
  const group = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const listId = variant + '-menu-' + useId()
  const list = useRef<HTMLUListElement>(null)
  const open = openedBy !== null
  const isCurrent = links.some(link => isCurrentLink(pathname, link.href))

  useEffect(() => { setOpenedBy(null) }, [pathname])

  // Editors may place a submenu at either end of the header. Keep it in view.
  useLayoutEffect(() => {
    if (!open || variant !== 'desktop') return
    function position() {
      if (!group.current || !list.current) return
      const width = list.current.getBoundingClientRect().width
      const left = group.current.getBoundingClientRect().left
      const x = Math.max(16, Math.min(left, document.documentElement.clientWidth - width - 16))
      list.current.style.left = x - left + 'px'
    }
    position()
    window.addEventListener('resize', position)
    return () => window.removeEventListener('resize', position)
  }, [open, variant, links])

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
      <ul ref={list} id={listId} className="information-links" hidden={!open}>
        {links.map(link => (
          <li key={link.id}>
            <Link
              href={link.href}
              target={link.newTab ? '_blank' : undefined}
              rel={link.newTab ? 'noopener noreferrer' : undefined}
              aria-current={isCurrentLink(pathname, link.href) ? 'page' : undefined}
              onClick={() => {
                setOpenedBy(null)
                onLinkClick?.()
              }}
            >
              {link.label}
              {link.newTab && <span className="sr-only"> (opens in a new tab)</span>}
              {variant === 'mobile' && <span aria-hidden="true">→</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function isCurrentLink(pathname: string, href: string) {
  return href.startsWith('/') && pathname === href.split(/[?#]/, 1)[0]
}

function NavigationItems({
  items, variant, pathname, onLinkClick,
}: {
  items: MenuItem[]
  variant: NavigationVariant
  pathname: string
  onLinkClick?: () => void
}) {
  return items.map(item => item.kind === 'submenu' ? (
    <NavigationSubmenu key={item.id} variant={variant} pathname={pathname} label={item.label} links={item.children} onLinkClick={onLinkClick} />
  ) : (
    <Link key={item.id} className="nav-item" href={item.href}
      target={item.newTab ? '_blank' : undefined}
      rel={item.newTab ? 'noopener noreferrer' : undefined}
      aria-current={isCurrentLink(pathname, item.href) ? 'page' : undefined}
      onClick={onLinkClick}
    >
      {item.label}
      {item.newTab && <span className="sr-only"> (opens in a new tab)</span>}
      {variant === 'mobile' && <span aria-hidden="true">→</span>}
    </Link>
  ))
}

export function Header({ menu }: { menu: MainMenuDTO }) {
  const [open, setOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  const pathname = usePathname()
  const menuButton = useRef<HTMLButtonElement>(null)
  const mobileNavigation = useRef<HTMLElement>(null)
  const header = useRef<HTMLElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const brand = useRef<HTMLAnchorElement>(null)
  const action = useRef<HTMLAnchorElement>(null)

  useEffect(() => { setOpen(false) }, [pathname, menu])
  useEffect(() => {
    if (open) mobileNavigation.current?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus()
  }, [open])

  // Custom labels and extra items can exceed the normal desktop breakpoint.
  // Measure an inert text-only copy so hiding the navigation cannot trigger a resize loop.
  useLayoutEffect(() => {
    let disposed = false
    function update() {
      if (disposed || !inner.current || !measure.current) return
      const style = getComputedStyle(inner.current)
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const gap = parseFloat(style.columnGap) || 0
      const available = inner.current.clientWidth - padding - (brand.current?.offsetWidth || 0) - (action.current?.offsetWidth || 0) - gap * (action.current ? 2 : 1)
      setCompact(menu.items.length > 0 && measure.current.scrollWidth > available + 1)
      header.current?.style.setProperty('--site-header-height', inner.current.offsetHeight + 'px')
    }
    const observer = new ResizeObserver(update)
    if (inner.current) observer.observe(inner.current)
    if (measure.current) observer.observe(measure.current)
    if (action.current) observer.observe(action.current)
    update()
    void document.fonts.ready.then(update)
    return () => { disposed = true; observer.disconnect() }
  }, [menu])

  return (
    <header ref={header} className="site-header" data-menu-overflow={compact || undefined} onKeyDown={event => {
      if (event.key === 'Escape' && open) { setOpen(false); menuButton.current?.focus() }
    }}>
      <div className="header-inner" ref={inner}>
        <Link ref={brand} href="/" className="brand" aria-label="Pets4Luv home">
          <img src="/images/logo.png" alt="Pets4Luv Foundation" width="200" height="200" />
        </Link>
        {menu.items.length > 0 && <nav className="desktop-nav" aria-label="Main navigation">
          <NavigationItems items={menu.items} variant="desktop" pathname={pathname} />
        </nav>}
        {menu.button && <Link ref={action} className="button donate-button" href={menu.button.href}
          target={menu.button.newTab ? '_blank' : undefined} rel={menu.button.newTab ? 'noopener noreferrer' : undefined}>
          {menu.button.label}{menu.button.newTab && <span className="sr-only"> (opens in a new tab)</span>}
        </Link>}
        {menu.items.length > 0 && <button ref={menuButton} type="button" className="menu-toggle"
          aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(value => !value)}>
          <span className="menu-lines" aria-hidden="true"><i /><i /><i /></span><span>{open ? 'Close' : 'Menu'}</span>
        </button>}
        <div className="navigation-measure-wrap" aria-hidden="true"><div ref={measure} className="desktop-nav navigation-measure">
          {menu.items.map(item => <span className="nav-item" key={item.id}>{item.label}</span>)}
        </div></div>
      </div>
      {menu.items.length > 0 && <nav ref={mobileNavigation} id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation" hidden={!open}>
        {open && <NavigationItems items={menu.items} variant="mobile" pathname={pathname} onLinkClick={() => setOpen(false)} />}
      </nav>}
    </header>
  )
}
