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
    const value = key === 'paypalHandle' && source.paypalHandle === undefined && source.paypalUrl !== undefined
      ? paypalHandleFromUrl(source.paypalUrl) : source[key]
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
  return value.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&')
}

/** Keep existing articles in sync, and support explicit shared-value references in new copy. */
export function applyWebsiteSettings<T>(value: T, settings: WebsiteSettings): T {
  const substitutions = new Map<string, string>()
  for (const key of publicSettingKeys) substitutions.set('{{' + key + '}}', settings[key])
  substitutions.set('{{email}}', settings.emailAddress)
  for (const key of publicSettingKeys) {
    if (!key.endsWith('Handle') && defaultWebsiteSettings[key]) substitutions.set(defaultWebsiteSettings[key], settings[key])
  }
  substitutions.set('@' + defaultWebsiteSettings.venmoHandle, settings.venmoHandle ? '@' + settings.venmoHandle : '')
  substitutions.set(phoneHref(defaultWebsiteSettings.phone), phoneHref(settings.phone))
  const patterns = [...substitutions.keys()].sort((a, b) => b.length - a.length).map(key =>
    escapePattern(key) + (key === '@' + defaultWebsiteSettings.venmoHandle ? '(?![a-zA-Z0-9_-])' : '')
  )
  const pattern = new RegExp(patterns.join('|'), 'g')
  // One pass avoids re-replacing text inside a newly inserted value.
  const replace = (text: string) => text.replace(pattern, match => substitutions.get(match) ?? match)
  function visit(node: any): any {
    if (!node || typeof node !== 'object') return node
    if (Array.isArray(node)) return node.map(visit)
    const next = { ...node }
    if (typeof next.text === 'string') next.text = replace(next.text)
    if (typeof next.url === 'string') next.url = replace(next.url)
    if (next.fields && typeof next.fields.url === 'string') next.fields = { ...next.fields, url: replace(next.fields.url) }
    if (next.children) next.children = visit(next.children)
    if (next.root) next.root = visit(next.root)
    return next
  }
  return visit(value)
}
