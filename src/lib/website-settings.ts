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
  paypalUrl: 'https://www.paypal.com/paypalme/pets4luvfoundation',
  venmoHandle: 'pets4luv',
  venmoUrl: 'https://venmo.com/pets4luv',
}

export type WebsiteSettings = { [Key in keyof typeof defaultWebsiteSettings]: string }
export const websiteSettingKeys = Object.keys(defaultWebsiteSettings) as (keyof WebsiteSettings)[]
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

export function normalizeVenmoHandle(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/^@+/, '') : ''
}

export function validateVenmoHandle(value: unknown): true | string {
  const handle = normalizeVenmoHandle(value)
  return !handle || /^[a-z0-9_-]{1,64}$/i.test(handle) ? true : 'Use the Venmo username only, without spaces or a URL.'
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
  result.venmoHandle = normalizeVenmoHandle(result.venmoHandle)
  return result
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&')
}

/** Keep existing articles in sync, and support explicit shared-value references in new copy. */
export function applyWebsiteSettings<T>(value: T, settings: WebsiteSettings): T {
  const substitutions = new Map<string, string>()
  for (const key of websiteSettingKeys) substitutions.set('{{' + key + '}}', settings[key])
  substitutions.set('{{email}}', settings.emailAddress)
  for (const key of websiteSettingKeys) {
    if (key !== 'venmoHandle' && defaultWebsiteSettings[key]) substitutions.set(defaultWebsiteSettings[key], settings[key])
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
