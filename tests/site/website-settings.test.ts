import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RichContent } from '../../src/components/RichContent'
import { SocialLinks } from '../../src/components/SocialLinks'
import { AdoptionDirectoryLinks } from '../../src/components/AdoptionDirectoryLinks'
import { applyWebsiteSettings, defaultWebsiteSettings, normalizePaymentHandle, phoneHref, validatePhone, validatePaypalHandle, validateVenmoHandle, validateWebsiteUrl, websiteSettingsDTO, websiteSettingKeys, paypalHandleFromUrl } from '../../src/lib/website-settings'

test('website setting defaults protect drafts and retain explicitly cleared optional links', () => {
  assert.deepEqual(websiteSettingsDTO(undefined), defaultWebsiteSettings)
  assert.deepEqual(websiteSettingsDTO({ ...defaultWebsiteSettings, emailAddress: 'private@example.invalid', _status: 'draft' }), defaultWebsiteSettings)
  const publicSettings = websiteSettingsDTO({ ...defaultWebsiteSettings, instagramUrl: null, facebookUrl: '', tiktokUrl: 'https://www.tiktok.com/@example', _status: 'published' })
  assert.equal(publicSettings.instagramUrl, '')
  assert.equal(publicSettings.facebookUrl, '')
  assert.equal(publicSettings.tiktokUrl, 'https://www.tiktok.com/@example')
  assert.equal(websiteSettingsDTO({ ...defaultWebsiteSettings, phone: '212-555-0100', _status: 'draft' }, true).phone, '212-555-0100')
})

test('shared links validate web destinations, contact numbers, and payment handles', () => {
  for (const value of ['', null, 'https://example.org/path?q=1', 'http://example.org']) assert.equal(validateWebsiteUrl(value), true)
  for (const value of ['javascript:alert(1)', '//example.org', 'https://user:password@example.org', 'not a url', 'https://example.org\\other', 'https://example.org/p\nath']) assert.notEqual(validateWebsiteUrl(value), true)
  assert.equal(validatePhone('(516) 860-7057'), true)
  assert.equal(validatePhone('+44 20 7946 0123'), true)
  assert.notEqual(validatePhone('call me'), true)
  assert.equal(phoneHref('(516) 860-7057'), 'tel:+15168607057')
  assert.equal(phoneHref('+44 20 7946 0123'), 'tel:+442079460123')
  assert.equal(normalizePaymentHandle(' @pets4luv '), 'pets4luv')
  assert.equal(validateVenmoHandle('@pets4luv-rescue'), true)
  assert.notEqual(validateVenmoHandle('https://venmo.com/example'), true)
  assert.notEqual(validateVenmoHandle('abc'), true)
  assert.equal(validatePaypalHandle('@RescueFoundation'), true)
  for (const value of ['rescue-name', 'name@example.org', 'https://paypal.me/example', 'x'.repeat(21), 123]) assert.notEqual(validatePaypalHandle(value), true)
  assert.equal(paypalHandleFromUrl('https://paypal.me/RescueFoundation'), 'RescueFoundation')
  assert.equal(paypalHandleFromUrl('https://www.paypal.com/paypalme/RescueFoundation/'), 'RescueFoundation')
  assert.equal(paypalHandleFromUrl('https://paypal.me.example.org/RescueFoundation'), '')
  assert.equal(websiteSettingsDTO({ ...defaultWebsiteSettings, zeffyUrl: 'javascript:alert(1)', _status: 'published' }).zeffyUrl, '')
})

test('shared contact values update existing rich text and explicit references without editing the stored document', () => {
  const settings = websiteSettingsDTO({ ...defaultWebsiteSettings, address: '10 Example Road, Freeport, NY 11520', emailAddress: 'hello@example.invalid', phone: '212-555-0100', venmoHandle: 'new-rescue', paypalHandle: 'NewRescue', _status: 'published' })
  const doc = { root: { children: [
    { type: 'paragraph', children: [{ type: 'text', text: defaultWebsiteSettings.address + '. Phone: ' + defaultWebsiteSettings.phone + '. Venmo @pets4luv. Pets4Luv Foundation.' }] },
    { type: 'paragraph', children: [
      { type: 'link', fields: { url: 'mailto:info@pets4luv.org?subject=Volunteering' }, children: [{ type: 'text', text: 'info@pets4luv.org' }] },
      { type: 'link', fields: { url: 'tel:+15168607057' }, children: [{ type: 'text', text: '{{phone}}' }] },
      { type: 'link', fields: { url: '{{venmoUrl}}' }, children: [{ type: 'text', text: '@{{venmoHandle}}' }] },
      { type: 'link', fields: { url: defaultWebsiteSettings.paypalUrl }, children: [{ type: 'text', text: 'PayPal' }] },
      { type: 'text', text: ' Email {{email}}; address {{address}}.' },
    ] },
  ] } }
  const original = JSON.stringify(doc)
  const resolved = applyWebsiteSettings(doc, settings)
  const output = renderToStaticMarkup(createElement(RichContent, { value: resolved }))
  for (const text of [settings.address, settings.emailAddress, settings.phone, '@new-rescue', 'Pets4Luv Foundation']) assert.ok(output.includes(text), output)
  assert.ok(output.includes('href="mailto:hello@example.invalid?subject=Volunteering"'))
  assert.ok(output.includes('href="tel:+12125550100"'))
  assert.ok(output.includes('href="https://venmo.com/new-rescue"'))
  assert.ok(output.includes('href="https://www.paypal.com/paypalme/NewRescue"'))
  assert.doesNotMatch(output, /info@pets4luv\.org|860-7057|\{\{/)
  assert.equal(JSON.stringify(doc), original)

  const nested = applyWebsiteSettings({ type: 'text', text: '{{emailAddress}}' }, { ...settings, emailAddress: 'info@pets4luv.org.example.invalid' })
  assert.equal(nested.text, 'info@pets4luv.org.example.invalid')
})

test('payment URLs derive only from saved handles and disappear when a handle is cleared', () => {
  assert.ok(!websiteSettingKeys.includes('paypalUrl' as any) && !websiteSettingKeys.includes('venmoUrl' as any))
  const settings = websiteSettingsDTO({ ...defaultWebsiteSettings, paypalHandle: ' @NewRescue ', venmoHandle: ' @new-rescue ', paypalUrl: 'https://example.org/old-paypal', venmoUrl: 'https://example.org/old-venmo', _status: 'published' })
  assert.equal(settings.paypalHandle, 'NewRescue')
  assert.equal(settings.paypalUrl, 'https://www.paypal.com/paypalme/NewRescue')
  assert.equal(settings.venmoHandle, 'new-rescue')
  assert.equal(settings.venmoUrl, 'https://venmo.com/new-rescue')
  const cleared = websiteSettingsDTO({ ...defaultWebsiteSettings, paypalHandle: null, venmoHandle: '', _status: 'published' })
  assert.equal(cleared.paypalUrl, '')
  assert.equal(cleared.venmoUrl, '')
  const invalid = websiteSettingsDTO({ ...defaultWebsiteSettings, paypalHandle: '../other', venmoHandle: 'bad/name', _status: 'published' })
  assert.equal(invalid.paypalUrl, '')
  assert.equal(invalid.venmoUrl, '')
  assert.equal(websiteSettingsDTO({ paypalUrl: 'https://paypal.me/LegacyRescue', _status: 'published' }).paypalHandle, 'LegacyRescue')
})

test('optional social and adoption directory links appear only when configured', () => {
  const social = renderToStaticMarkup(createElement(SocialLinks, { settings: { instagramUrl: '', facebookUrl: '', tiktokUrl: 'https://www.tiktok.com/@example' } }))
  assert.ok(social.includes('TikTok'))
  assert.ok(social.includes('<svg'))
  assert.doesNotMatch(social, /Instagram|Facebook/)
  assert.equal(renderToStaticMarkup(createElement(SocialLinks, { settings: { instagramUrl: '', facebookUrl: '', tiktokUrl: '' } })), '')

  const single = renderToStaticMarkup(createElement(AdoptionDirectoryLinks, { settings: { petfinderUrl: 'https://example.org/pets', adoptAPetUrl: '' } }))
  assert.ok(single.includes('Petfinder'))
  assert.doesNotMatch(single, /Adopt a pet| and /)
  const both = renderToStaticMarkup(createElement(AdoptionDirectoryLinks, { settings: defaultWebsiteSettings }))
  assert.ok(both.includes('Petfinder') && both.includes(' and ') && both.includes('Adopt a pet'))
  assert.equal(renderToStaticMarkup(createElement(AdoptionDirectoryLinks, { settings: { petfinderUrl: '', adoptAPetUrl: '' } })), '')
})
