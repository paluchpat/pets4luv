'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const navigation = [
  { href: '/', label: 'Home' },
  { href: '/animals', label: 'Adopt' },
  { href: '/info/adoption', label: 'About adoption' },
  { href: '/applications', label: 'Applications' },
  { href: '/info/volunteering', label: 'Volunteer' },
  { href: '/about', label: 'About us' },
]

export function Header() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const menuButton = useRef<HTMLButtonElement>(null)
  const firstLink = useRef<HTMLAnchorElement>(null)
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => { if (open) firstLink.current?.focus() }, [open])
  return <header className="site-header" onKeyDown={(event) => {
    if (event.key === 'Escape' && open) { setOpen(false); menuButton.current?.focus() }
  }}>
    <div className="header-inner">
      <Link href="/" className="brand" aria-label="Pets4Luv home"><img src="/images/logo.png" alt="Pets4Luv Foundation" width="200" height="200" /></Link>
      <nav className="desktop-nav" aria-label="Main navigation">{navigation.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined}>{item.label}</Link>)}</nav>
      <Link className="button donate-button" href="/donate">Donate</Link>
      <button ref={menuButton} type="button" className="menu-toggle" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(value => !value)}><span className="menu-lines" aria-hidden="true"><i /><i /><i /></span><span>{open ? 'Close' : 'Menu'}</span></button>
    </div>
    {open && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">{navigation.map((item, index) => <Link ref={index === 0 ? firstLink : undefined} key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined} onClick={() => setOpen(false)}>{item.label}<span aria-hidden="true">→</span></Link>)}</nav>}
  </header>
}
