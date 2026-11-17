import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultMainMenu, mainMenuDTO, menuPageIDs, menuPageLabels, validateMenuUrl, type MainMenuRecord } from '../../src/lib/main-menu'

test('the initial menu preserves existing navigation and footer labels', () => {
  const menu = mainMenuDTO(undefined)
  assert.deepEqual(menu.items.map(item => item.label), ['Home', 'Adopt', 'Information', 'About us', 'Contact'])
  const information = menu.items[2]
  assert.equal(information.kind, 'submenu')
  if (information.kind !== 'submenu') return
  assert.deepEqual(information.children.map(item => item.label), ['About adoptions', 'Volunteer', 'Forms and applications', 'Trap-Neuter-Return (TNR)', 'Medical assistance', 'Injured feral cats'])
  assert.equal(menu.button?.label, 'Donate')
  assert.equal(menu.button?.href, '/donate')
  assert.deepEqual(menu.footerLinks.map(item => item.label), ['Adopt', 'About adoptions', 'Volunteer', 'Forms and applications', 'About us', 'Contact', 'Donate'])
  assert.deepEqual(mainMenuDTO({ _status: 'draft', items: [{ label: 'PRIVATE DRAFT', linkType: 'custom', url: '/private' }] }), menu)
})

test('published removals and disabled buttons stay removed while staff can preview drafts', () => {
  const empty = { _status: 'published', items: [], highlightedButton: { enabled: false } }
  assert.deepEqual(mainMenuDTO(empty), { items: [], button: null, footerLinks: [] })
  const draft = { ...empty, _status: 'draft' }
  assert.deepEqual(mainMenuDTO(draft, [], true), mainMenuDTO(empty))
  assert.deepEqual(mainMenuDTO(draft), mainMenuDTO(undefined))
})

test('page references follow the published slug and hide draft, deleted, or malformed pages', () => {
  const doc: MainMenuRecord = { _status: 'published', items: [1, 2, 3, 4].map(id => ({ label: 'Page ' + id, linkType: 'page', page: { id } })) }
  assert.deepEqual(menuPageIDs(doc), ['1', '2', '3', '4'])
  const menu = mainMenuDTO(doc, [
    { id: 1, slug: 'new-page-address', _status: 'published' },
    { id: 2, slug: 'private-page', _status: 'draft' },
    { id: 4, slug: '../admin', _status: 'published' },
  ])
  assert.deepEqual(menu.items.map(item => item.kind === 'link' && item.href), ['/new-page-address'])
  const adoption = mainMenuDTO(doc, [{ id: 1, slug: 'adoption', _status: 'published' }]).items[0]
  assert.equal(adoption.kind === 'link' && adoption.href, '/info/adoption')
})

test('ordered custom links, multiple submenus and matching footer selections resolve safely', () => {
  const row = (label: string, url: string) => ({ label, url, linkType: 'custom', newTab: true, showInFooter: true })
  const menu = mainMenuDTO({ _status: 'published', items: [
    row('Partner', 'https://example.org'),
    { label: 'Help', linkType: 'submenu', children: [row('Email us', 'mailto:hello@example.invalid')] },
    { label: 'Visit', linkType: 'submenu', children: [row('Call us', 'tel:+15165550100'), row('Duplicate', 'https://example.org')] },
    { label: 'Empty submenu', linkType: 'submenu', children: [] },
    row('Unsafe', 'javascript:alert(1)'), row('Old mission', 'https://www.pets4luv.org/Our-Mission'),
  ], highlightedButton: { ...row('Support us', '/donate'), enabled: true } })
  assert.deepEqual(menu.items.map(item => item.label), ['Partner', 'Help', 'Visit', 'Old mission'])
  assert.deepEqual(menu.footerLinks.map(item => [item.label, item.href, item.newTab]), [
    ['Partner', 'https://example.org', true], ['Email us', 'mailto:hello@example.invalid', true],
    ['Call us', 'tel:+15165550100', true], ['Old mission', '/about', true], ['Support us', '/donate', true],
  ])
  assert.equal(validateMenuUrl('javascript:alert(1)') === true, false)
  assert.equal(validateMenuUrl('https://user:secret@example.org') === true, false)
  assert.equal(validateMenuUrl('/animals?species=cat#gallery-results'), true)
  assert.ok(!JSON.stringify(menu).includes('javascript'))
})

test('CMS page labels use the published menu, including relationship IDs after renaming pages', () => {
  const menu: MainMenuRecord = { _status: 'published', items: [{ label: 'Renamed about link', linkType: 'page', page: 10 }, { label: 'Contact us', linkType: 'custom', url: '/contact' }] }
  const labels = menuPageLabels(menu)
  assert.equal(labels.get('page:10'), 'Renamed about link')
  assert.equal(labels.get('url:/contact'), 'Contact us')
  assert.deepEqual(menuPageLabels({ ...defaultMainMenu, _status: 'draft' }), menuPageLabels(undefined))
})
