/** Public defaults used only before the settings global is initialized. */
export const defaultWebsiteSettings = {
  address: '2 Rider Place, Freeport, NY 11520',
  instagramUrl: 'https://www.instagram.com/pets4luvfoundation/',
  facebookUrl: 'https://www.facebook.com/Pets4Luv/',
  tiktokUrl: '',
  petfinderUrl: 'https://www.petfinder.com/search/cats-for-adoption/?shelterRescue=521e2d23-2a7e-4a1d-8a22-b6c7e0acf003&includeOutOfTown=true',
  adoptAPetUrl: 'https://www.adoptapet.com/shelter/89959-pets4luv-foundation-hicksville-new-york',
  emailAddress: 'info@pets4luv.org',
  phone: '(516) 860-7057',
  zeffyUrl: 'https://www.zeffy.com/en-US/donation-form/help-needed-for-medical-costs',
  paypalHandle: 'pets4luvfoundation',
  paypalUrl: paypalProfileUrl('pets4luvfoundation'),
  venmoHandle: 'pets4luv',
  venmoUrl: venmoProfileUrl('pets4luv'),
}

export type WebsiteSettings = { [Key in keyof typeof defaultWebsiteSettings]: string }
export type StoredWebsiteSettings = Omit<WebsiteSettings, 'paypalUrl' | 'venmoUrl'>
const publicSettingKeys = Object.keys(defaultWebsiteSettings) as (keyof WebsiteSettings)[]
export const websiteSettingKeys = publicSettingKeys.filter(key => key !== 'paypalUrl' && key !== 'venmoUrl') as (keyof StoredWebsiteSettings)[]
const requiredKeys = ['address', 'emailAddress', 'phone'] as const

export function validateWebsiteUrl(value: unknown): true | string {
  if (value == null || value === '') return true
  if (typeof value !== 'string') return 'Enter a full website URL.'
  const url = value.trim()
  if (!url) return true
  if (!/^https?:\/\//i.test(url) || /[\u0000-\u001f\u007f\\]/.test(url)) return 'Use a full URL beginning with https:// or http://.'
  try {
    const parsed = new URL(url)
    if (!parsed.hostname || parsed.username || parsed.password) return 'Enter a website URL without login details.'
    return true
  } catch { return 'Enter a valid website URL.' }
}

export function validatePhone(value: unknown): true | string {
  if (typeof value !== 'string' || !/^\+?[\d(). -]+$/.test(value.trim())) return 'Enter a phone number, including its area code.'
  const digits = value.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15 ? true : 'Enter a phone number with 7 to 15 digits.'
}

export function normalizePaymentHandle(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/^@+/, '') : ''
}

export function validateVenmoHandle(value: unknown): true | string {
  if (value == null) return true
  const handle = normalizePaymentHandle(value)
  return typeof value === 'string' && (!handle || /^[a-z0-9_-]{5,30}$/i.test(handle)) ? true : 'Use a Venmo username with 5–30 letters, numbers, hyphens, or underscores, without a URL.'
}

export function validatePaypalHandle(value: unknown): true | string {
  if (value == null) return true
  const handle = normalizePaymentHandle(value)
  return typeof value === 'string' && (!handle || /^[a-z0-9]{1,20}$/i.test(handle)) ? true : 'Use your PayPal.Me handle: up to 20 letters or numbers, without spaces or a URL.'
}

export function venmoProfileUrl(value: unknown): string {
  const handle = normalizePaymentHandle(value)
  return handle && validateVenmoHandle(value) === true ? 'https://venmo.com/' + encodeURIComponent(handle) : ''
}

export function paypalProfileUrl(value: unknown): string {
  const handle = normalizePaymentHandle(value)
  return handle && validatePaypalHandle(value) === true ? 'https://www.paypal.com/paypalme/' + encodeURIComponent(handle) : ''
}

/** Preserve a previously configured PayPal.Me account when upgrading old settings. */
export function paypalHandleFromUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || validateWebsiteUrl(value) !== true) return ''
  const url = new URL(value.trim())
  if (url.port) return ''
  const path = ['paypal.me', 'www.paypal.me'].includes(url.hostname)
    ? /^\/([a-z0-9]{1,20})\/?$/i.exec(url.pathname)
    : ['paypal.com', 'www.paypal.com'].includes(url.hostname) ? /^\/paypalme\/([a-z0-9]{1,20})\/?$/i.exec(url.pathname) : null
  return path?.[1] || ''
}

export function phoneHref(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const international = phone.trim().startsWith('+') || (digits.length === 11 && digits.startsWith('1'))
  return 'tel:' + (digits.length === 10 ? '+1' + digits : international ? '+' + digits : digits)
}

/** Reconstruct the public fields; never expose an unpublished first draft. */
export function websiteSettingsDTO(
  doc: Partial<Record<keyof WebsiteSettings, unknown>> & { _status?: string | null } | null | undefined,
  staffPreview = false,
): WebsiteSettings {
  const source = doc && (staffPreview || doc._status === 'published') ? doc : defaultWebsiteSettings
  const result = Object.fromEntries(websiteSettingKeys.map(key => {
    const value = source[key]
    return [key, value === undefined ? defaultWebsiteSettings[key] : typeof value === 'string' ? value.trim() : '']
  })) as WebsiteSettings
  for (const key of requiredKeys) if (!result[key]) result[key] = defaultWebsiteSettings[key]
  for (const key of websiteSettingKeys) if (key.endsWith('Url') && validateWebsiteUrl(result[key]) !== true) result[key] = ''
  result.venmoHandle = validateVenmoHandle(result.venmoHandle) === true ? normalizePaymentHandle(result.venmoHandle) : ''
  result.paypalHandle = validatePaypalHandle(result.paypalHandle) === true ? normalizePaymentHandle(result.paypalHandle) : ''
  result.venmoUrl = venmoProfileUrl(result.venmoHandle)
  result.paypalUrl = paypalProfileUrl(result.paypalHandle)
  return result
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

type SettingsSnapshot = Partial<Record<keyof WebsiteSettings, unknown>>

/** Replace text across adjacent Lexical text nodes without losing their formatting. */
function transformSharedStrings<T>(value: T, pattern: RegExp, replacement: (match: string) => string): T {
  const replace = (text: string) => text.replace(pattern, replacement)
  function textRun(nodes: any[]): any[] {
    const joined = nodes.map(node => node.text).join('')
    const matches = [...joined.matchAll(pattern)]
    if (!matches.length) return nodes.map(visit)
    let offset = 0
    return nodes.map(node => {
      const start = offset
      const end = start + node.text.length
      offset = end
      let cursor = start
      let text = ''
      for (const match of matches) {
        const matchStart = match.index!
        const matchEnd = matchStart + match[0].length
        if (matchEnd <= start || matchStart >= end) continue
        text += joined.slice(cursor, Math.max(cursor, matchStart))
        if (matchStart >= start) text += replacement(match[0])
        cursor = Math.min(end, matchEnd)
      }
      text += joined.slice(cursor, end)
      return { ...node, text }
    })
  }
  function visit(node: any): any {
    if (typeof node === 'string') return replace(node)
    if (!node || typeof node !== 'object') return node
    if (Array.isArray(node)) {
      const result: any[] = []
      for (let index = 0; index < node.length;) {
        if (node[index]?.type === 'text' && typeof node[index].text === 'string') {
          const run = []
          while (node[index]?.type === 'text' && typeof node[index].text === 'string') run.push(node[index++])
          result.push(...textRun(run))
        } else result.push(visit(node[index++]))
      }
      return result
    }
    return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, visit(child)]))
  }
  return visit(value)
}

/** Recognize only this rescue's configured values, including earlier settings revisions. */
export function createWebsiteSettingsReferences(snapshots: readonly SettingsSnapshot[] = []) {
  const aliases = new Map<string, { token: string; boundary: string }>()
  function add(value: unknown, token: string, boundary = '(?![a-z0-9_@/-]|\\.[a-z0-9])') {
    if (typeof value === 'string' && value.trim()) aliases.set(value.trim().toLowerCase(), { token, boundary })
  }
  for (const source of [defaultWebsiteSettings, ...snapshots]) {
    for (const key of publicSettingKeys) {
      if (key === 'phone' || key.endsWith('Handle')) continue
      const value = source[key]
      if (key.endsWith('Url') && validateWebsiteUrl(value) !== true) continue
      add(value, '{{' + key + '}}')
      if (key.endsWith('Url') && typeof value === 'string' && value) add(value.replace(/\/$/, '') + '/', '{{' + key + '}}')
    }
    if (typeof source.emailAddress === 'string' && source.emailAddress) add('mailto:' + source.emailAddress, '{{emailHref}}')
    if (typeof source.phone === 'string' && source.phone) {
      const digits = source.phone.replace(/\D/g, '')
      const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
      const formats = new Set([source.phone, digits, '+' + digits])
      if (local.length === 10) {
        const area = local.slice(0, 3), exchange = local.slice(3, 6), line = local.slice(6)
        for (const separator of ['-', '.', ' ']) formats.add([area, exchange, line].join(separator))
        formats.add(`(${area})${exchange}-${line}`)
        formats.add(`(${area}) ${exchange} ${line}`)
        formats.add('1-' + [area, exchange, line].join('-'))
      }
      for (const format of formats) {
        add(format, '{{phone}}', '(?![0-9])')
        add('tel:' + format.replace(/[ ()]/g, ''), '{{phoneHref}}', '(?![0-9])')
      }
      add(phoneHref(source.phone), '{{phoneHref}}', '(?![0-9])')
    }
    for (const key of ['venmoHandle', 'paypalHandle'] as const) {
      const handle = normalizePaymentHandle(source[key])
      if (handle) add('@' + handle, '@{{' + key + '}}')
      add(key === 'venmoHandle' ? venmoProfileUrl(handle) : paypalProfileUrl(handle), '{{' + (key === 'venmoHandle' ? 'venmoUrl' : 'paypalUrl') + '}}')
    }
  }
  add('tel:{{phone}}', '{{phoneHref}}')
  add('mailto:{{emailAddress}}', '{{emailHref}}')
  add('mailto:{{email}}', '{{emailHref}}')
  const alternatives = [...aliases.keys()].sort((a, b) => b.length - a.length).map(alias =>
    '(?<![a-z0-9_@])' + escapePattern(alias) + aliases.get(alias)!.boundary,
  )
  const pattern = new RegExp(alternatives.join('|'), 'gi')
  return <T>(value: T): T => transformSharedStrings(value, pattern, match => aliases.get(match.toLowerCase())!.token)
}

export function referenceWebsiteSettings<T>(value: T, snapshots: readonly SettingsSnapshot[] = []): T {
  return createWebsiteSettingsReferences(snapshots)(value)
}

export function isSharedWebsiteUrl(value: string): boolean {
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return false
  const keys = [...publicSettingKeys.filter(key => key.endsWith('Url')), 'phoneHref', 'emailHref']
  return new RegExp('^\\{\\{\\s*(?:' + keys.join('|') + ')\\s*\\}\\}(?:[?#][^\\s]*)?$').test(value)
}

/** Resolve references in one pass so inserted CMS values are never processed again. */
export function applyWebsiteSettings<T>(value: T, settings: WebsiteSettings): T {
  const references = referenceWebsiteSettings(value)
  const values: Record<string, string> = { ...settings, email: settings.emailAddress, phoneHref: phoneHref(settings.phone), emailHref: 'mailto:' + settings.emailAddress }
  const pattern = /\{\{\s*([a-zA-Z]+)\s*\}\}/g
  return transformSharedStrings(references, pattern, match => {
    const key = match.slice(2, -2).trim()
    return Object.hasOwn(values, key) ? values[key] : match
  })
}
