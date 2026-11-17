import { resolvePublicHref } from './site-links'
import { siteLinks } from './site-navigation'

export const builtInMenuPages = [
  { value: 'home', label: 'Home', href: '/' },
  { value: 'animals', label: 'Adopt (animal gallery)', href: '/animals' },
  { value: 'applications', label: 'Forms and applications', href: '/applications' },
] as const

export type MenuRecord = {
  id?: string | null
  label?: string | null
  linkType?: string | null
  page?: number | string | { id?: number | string } | null
  builtIn?: string | null
  url?: string | null
  newTab?: boolean | null
  showInFooter?: boolean | null
  children?: MenuRecord[] | null
}
export type MainMenuRecord = {
  id?: number | string
  _status?: string | null
  items?: MenuRecord[] | null
  highlightedButton?: (MenuRecord & { enabled?: boolean | null }) | null
}
export type MenuLink = { kind: 'link'; id: string; label: string; href: string; newTab: boolean; showInFooter: boolean }
export type MenuGroup = { kind: 'submenu'; id: string; label: string; children: MenuLink[] }
export type MenuItem = MenuLink | MenuGroup
export type MainMenuDTO = { items: MenuItem[]; button: MenuLink | null; footerLinks: MenuLink[] }
export type MenuPage = { id: number | string; slug: string; _status?: string | null }

const link = (item: { label: string; href: string }, showInFooter = true): MenuRecord => ({
  label: item.label, linkType: 'custom', url: item.href, newTab: false, showInFooter,
})

/** Initial content only. A deliberately empty published menu stays empty. */

export const defaultMainMenu: MainMenuRecord = {
  items: [
    { label: 'Home', linkType: 'builtIn', builtIn: 'home', newTab: false, showInFooter: false },
    { label: 'Adopt', linkType: 'builtIn', builtIn: 'animals', newTab: false, showInFooter: true },
    { label: 'Information', linkType: 'submenu', children: [
      link(siteLinks.adoption), link(siteLinks.volunteer),
      { label: siteLinks.applications.label, linkType: 'builtIn', builtIn: 'applications', newTab: false, showInFooter: true },
      link(siteLinks.tnr, false), link(siteLinks.medical, false), link(siteLinks.injuredFeralCats, false),
    ] },
    link(siteLinks.about), link(siteLinks.contact),
  ],
  highlightedButton: { ...link(siteLinks.donate), enabled: true },
}

export function publicPageHref(slug: string): string {
  return slug === 'adoption' || slug === 'volunteering' ? '/info/' + slug : '/' + slug
}

export function menuPageID(value: MenuRecord['page']): string | null {
  const id = value && typeof value === 'object' ? value.id : value
  return typeof id === 'number' || typeof id === 'string' ? String(id) : null
}

export function menuRecords(menu: MainMenuRecord): MenuRecord[] {
  const rows = (menu.items || []).flatMap(item => item.linkType === 'submenu' ? item.children || [] : [item])
  if (menu.highlightedButton?.enabled) rows.push(menu.highlightedButton)
  return rows
}

export function menuPageIDs(menu: MainMenuRecord): string[] {
  return [...new Set(menuRecords(menu).flatMap(row => {
    const id = row.linkType === 'page' ? menuPageID(row.page) : null
    return id ? [id] : []
  }))]
}

export function validateMenuUrl(value: unknown): true | string {
  return typeof value === 'string' && value.trim().length <= 2048 && resolvePublicHref(value)
    ? true : 'Enter a website path such as /animals, a full https:// URL, an email link, or a phone link.'
}

export function validateMenuLabel(value: unknown): true | string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 80
    ? true : 'Enter a short menu label (1 to 80 characters).'
}

export function mainMenuDTO(doc: MainMenuRecord | null | undefined, pages: readonly MenuPage[] = [], staffPreview = false): MainMenuDTO {
  const source = doc && (staffPreview || doc._status === 'published') ? doc : defaultMainMenu
  const publishedPages = new Map(pages.filter(page => page._status === 'published').map(page => [String(page.id), page]))
  function toLink(row: MenuRecord, id: string): MenuLink | null {
    const label = row.label?.trim()
    if (validateMenuLabel(label) !== true) return null
    let href: string | null = null
    if (row.linkType === 'builtIn') href = builtInMenuPages.find(page => page.value === row.builtIn)?.href || null
    if (row.linkType === 'custom') href = typeof row.url === 'string' ? resolvePublicHref(row.url) : null
    if (row.linkType === 'page') {
      const page = publishedPages.get(menuPageID(row.page) || '')
      if (page && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug)) href = publicPageHref(page.slug)
    }
    return href ? { kind: 'link', id: row.id || id, label: label!, href, newTab: Boolean(row.newTab), showInFooter: Boolean(row.showInFooter) } : null
  }
  const items: MainMenuDTO['items'] = (source.items || []).flatMap((row, index): MainMenuDTO['items'] => {
    if (row.linkType === 'submenu') {
      if (validateMenuLabel(row.label) !== true) return []
      const children = (row.children || []).flatMap((child, childIndex) => {
        const resolved = toLink(child, 'menu-' + index + '-' + childIndex)
        return resolved ? [resolved] : []
      })
      return children.length ? [{ kind: 'submenu', id: row.id || 'menu-' + index, label: row.label!.trim(), children }] : []
    }
    const resolved = toLink(row, 'menu-' + index)
    return resolved ? [resolved] : []
  })
  const button = source.highlightedButton?.enabled ? toLink(source.highlightedButton, 'highlighted-button') : null
  const seen = new Set<string>()
  const footerLinks = [...items.flatMap(item => item.kind === 'submenu' ? item.children : [item]), ...(button ? [button] : [])].filter(item => {
    if (!item.showInFooter || seen.has(item.href)) return false
    seen.add(item.href)
    return true
  })
  return { items, button, footerLinks }
}

/** Match CMS sidebar labels to the live menu, including after a page's slug changes. */
export function menuPageLabels(doc: MainMenuRecord | null | undefined): Map<string, string> {
  const source = doc?._status === 'published' ? doc : defaultMainMenu
  const labels = new Map<string, string>()
  for (const row of menuRecords(source)) {
    if (validateMenuLabel(row.label) !== true) continue
    if (row.linkType === 'page') {
      const id = menuPageID(row.page)
      if (id) labels.set('page:' + id, row.label!.trim())
    }
    if (row.linkType === 'custom' && row.url) {
      const href = resolvePublicHref(row.url)
      if (href) labels.set('url:' + href, row.label!.trim())
    }
  }
  return labels
}
