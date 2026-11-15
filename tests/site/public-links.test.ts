import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RichContent } from '../../src/components/RichContent'

function renderLink(url: string, newTab = false, type: 'link' | 'autolink' = 'link') {
  const value = { root: { children: [{ type: 'paragraph', children: [{ type, fields: { url, newTab }, children: [{ type: 'text', text: 'Read more' }] }] }] } }
  return renderToStaticMarkup(createElement(RichContent, { value }))
}

test('legacy donation, contact and about links render as same-tab local links', () => {
  for (const [url, path] of [['https://www.pets4luv.org/Donate', '/donate'], ['http://pets4luv.org/Contact-Us', '/contact'], ['https://pets4luv.org/About', '/about'], ['https://pets4luv.org/Our-Mission', '/about']]) {
    const output = renderLink(url, true)
    assert.ok(output.includes(`href="${path}"`), output)
    assert.doesNotMatch(output, /target=|rel=|pets4luv\.org/)
  }
})

test('protocol-relative and case variants are rewritten for link and autolink nodes', () => {
  for (const [url, path] of [['//WWW.PETS4LUV.ORG/Donate', '/donate'], ['HTTPS://Pets4Luv.Org/CONTACT-US', '/contact']]) {
    for (const type of ['link', 'autolink'] as const) {
      const output = renderLink(url, true, type)
      assert.ok(output.includes(`href="${path}"`), output)
      assert.doesNotMatch(output, /target=/)
    }
  }
})

test('unknown legacy destinations retain readable text without outgoing anchors', () => {
  for (const url of ['https://www.pets4luv.org/old-campaign', '//PETS4LUV.ORG/unknown']) {
    const output = renderLink(url, true)
    assert.match(output, /Read more/)
    assert.doesNotMatch(output, /<a\b|href=|target=/)
  }
})

test('local and hash destinations are preserved in the same tab', () => {
  for (const url of ['/animals?species=cat#results', '/contact', '#adoption']) {
    const output = renderLink(url, true)
    assert.ok(output.includes(`href="${url}"`), output)
    assert.doesNotMatch(output, /target=/)
  }
})

test('unrelated external resources retain their URL and requested new-tab behavior', () => {
  const output = renderLink('https://example.org/pet-care', true)
  assert.match(output, /href="https:\/\/example\.org\/pet-care"/)
  assert.match(output, /target="_blank"/)
  assert.match(output, /rel="noopener noreferrer"/)
  assert.doesNotMatch(renderLink('https://example.org/pet-care'), /target=/)
})
