import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePublicHref } from '../../src/lib/site-links'

test('old-site URLs resolve only to known local destinations', () => {
  const paths = { '': '/', '/': '/', '/donate': '/donate', '/contact-us': '/contact', '/contact': '/contact', '/adopt': '/animals', '/adoption': '/info/adoption', '/Cat-Adoption-Information': '/info/adoption#cat-adoption', '/Dog-Adoption-Information': '/info/adoption#dog-adoption', '/volunteer': '/info/volunteering', '/Volunteering': '/info/volunteering', '/about': '/about', '/info/about': '/about', '/Our-Mission': '/about' }
  for (const host of ['https://pets4luv.org', 'http://www.pets4luv.org', '//PETS4LUV.ORG', 'https://legacy.Pets4Luv.org', 'https://pets4luv.org.']) {
    for (const [legacy, local] of Object.entries(paths)) {
      assert.equal(resolvePublicHref(`${host}${legacy}`), local)
    }
  }
  assert.equal(resolvePublicHref('  https://www.Pets4Luv.org/DONATE/?from=footer#ways-to-help  '), '/donate?from=footer#ways-to-help')
  assert.equal(resolvePublicHref('https://pets4luv.org/%63ontact-us'), '/contact')
  assert.equal(resolvePublicHref('https://%70ets4luv.org/adopt'), '/animals')
  assert.equal(resolvePublicHref('https://pets4luv.org/Cat-Adoption-Information?from=guide'), '/info/adoption?from=guide#cat-adoption')
  assert.equal(resolvePublicHref('https://pets4luv.org/Dog-Adoption-Information?from=guide#requirements'), '/info/adoption?from=guide#requirements')
})

test('unknown legacy URLs become plain text, including subdomains and hashes', () => {
  for (const url of ['https://pets4luv.org/old-campaign', '//www.pets4luv.org/missing?x=1#donate', 'https://sub.pets4luv.org/animals/luna', 'http://pets4luv.org/%ZZ', 'https://pets4luv.org/donate/extra']) {
    assert.equal(resolvePublicHref(url), null, url)
  }
})

test('safe local, contact, hash and unrelated external links are preserved', () => {
  for (const url of ['/', '/donate', '/animals?species=cat#results', '#support', 'mailto:hello@example.org', 'tel:+15551234567', 'https://example.org/help', 'http://example.org/help?q=1#info', '//example.org/help', 'https://pets4luv.org.example.com/donate', 'https://notpets4luv.org']) {
    assert.equal(resolvePublicHref(url), url, url)
  }
  assert.equal(resolvePublicHref('  /contact  '), '/contact')
  assert.equal(resolvePublicHref('/Our-Mission/?source=footer#history'), '/about?source=footer#history')
  assert.equal(resolvePublicHref('/info/about'), '/about')
})

test('unsafe protocols, confusing URL syntax and malformed URLs are rejected', () => {
  for (const url of ['', ' ', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'file:///tmp/test', 'ftp://pets4luv.org/donate', 'javascript\n:alert(1)', '/\\pets4luv.org/donate', 'https:\\pets4luv.org', 'https://', 'https://name:password@example.org', 'relative/path', 'mailto:', 'tel:']) {
    assert.equal(resolvePublicHref(url), null, url)
  }
})
