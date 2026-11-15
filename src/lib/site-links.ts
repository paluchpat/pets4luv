const localAliases: Record<string, string> = {
  '/info/about': '/about',
  '/our-mission': '/about',
  '/tnr': '/tnr',
  '/medical': '/medical',
  '/medical-assistance': '/medical',
  '/injured-feral-cats': '/injured-feral-cats',
}

const legacyPaths: Record<string, string> = {
  '/': '/',
  '/donate': '/donate',
  '/contact-us': '/contact',
  '/contact': '/contact',
  '/adopt': '/animals',
  '/adoption': '/info/adoption',
  '/applications': '/applications',
  '/cat-adoption-information': '/info/adoption#cat-adoption',
  '/dog-adoption-information': '/info/adoption#dog-adoption',
  '/volunteer': '/info/volunteering',
  '/volunteering': '/info/volunteering',
  '/about': '/about',
  ...localAliases,
}

/** Resolve saved public links without ever sending visitors to the previous site. */
export function resolvePublicHref(url: string): string | null {
  const href = url.trim()
  // Browser URL parsers discard embedded controls and interpret backslashes as slashes.
  if (!href || /[\u0000-\u001f\u007f\\]/.test(href)) return null
  if (href.startsWith('#')) return href
  if (/^(mailto|tel):\S+$/i.test(href)) return href
  if (href.startsWith('/') && !href.startsWith('//')) {
    const [path] = href.split(/[?#]/, 1)
    const destination = localAliases[path.toLowerCase().replace(/\/+$/, '')]
    return destination ? `${destination}${href.slice(path.length)}` : href
  }
  if (!/^(https?:\/\/|\/\/)/i.test(href)) return null

  let parsed: URL
  try { parsed = new URL(href.startsWith('//') ? `https:${href}` : href) } catch { return null }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return null

  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, '')
  if (hostname !== 'pets4luv.org' && !hostname.endsWith('.pets4luv.org')) return href

  let pathname: string
  try { pathname = decodeURIComponent(parsed.pathname).toLowerCase().replace(/\/+$/, '') || '/' } catch { return null }
  const destination = legacyPaths[pathname]
  if (!destination) return null
  const [path, anchor] = destination.split('#')
  return `${path}${parsed.search}${parsed.hash || (anchor ? `#${anchor}` : '')}`
}
