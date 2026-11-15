const legacyPaths: Record<string, string> = {
  '/': '/',
  '/donate': '/donate',
  '/contact-us': '/contact',
  '/contact': '/contact',
  '/adopt': '/animals',
  '/adoption': '/info/adoption',
  '/volunteer': '/info/volunteering',
  '/volunteering': '/info/volunteering',
  '/about': '/about',
  '/info/about': '/about',
  '/our-mission': '/about',
}

/** Resolve saved public links without ever sending visitors to the previous site. */
export function resolvePublicHref(url: string): string | null {
  const href = url.trim()
  // Browser URL parsers discard embedded controls and interpret backslashes as slashes.
  if (!href || /[\u0000-\u001f\u007f\\]/.test(href)) return null
  if (href.startsWith('#')) return href
  if (/^(mailto|tel):\S+$/i.test(href)) return href
  if (href.startsWith('/') && !href.startsWith('//')) {
    return href.replace(/^\/(?:our-mission|info\/about)\/*(?=[?#]|$)/i, '/about')
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
  return destination ? `${destination}${parsed.search}${parsed.hash}` : null
}
