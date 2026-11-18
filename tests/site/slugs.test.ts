import assert from 'node:assert/strict'
import test from 'node:test'
import { fillEmptySlug } from '../../src/lib/slug'
import { validatePageSlug } from '../../src/collections/Pages'

test('blank slugs become readable URL addresses from complete titles or animal names', () => {
  for (const blank of [undefined, null, '', '  ']) {
    assert.equal(fillEmptySlug(blank, '  Senior Cats & Dogs!  '), 'senior-cats-dogs')
  }
  assert.equal(fillEmptySlug('', 'Café — Poppy’s story'), 'cafe-poppys-story')
  assert.equal(fillEmptySlug('', 'Poppy'), 'poppy')
})

test('existing and manually entered slugs survive title changes exactly as entered', () => {
  for (const slug of ['poppy', 'custom-rescue-page', 'old-title']) {
    assert.equal(fillEmptySlug(slug, 'A completely different title'), slug)
    assert.equal(fillEmptySlug(slug, ''), slug)
  }
  assert.equal(fillEmptySlug('My custom URL', 'New title'), 'My custom URL')
})

test('generated slugs still respect page route validation', () => {
  assert.equal(validatePageSlug(fillEmptySlug('', 'Help the animals')), true)
  assert.notEqual(validatePageSlug(fillEmptySlug('', 'Animals')), true)
  assert.notEqual(validatePageSlug(fillEmptySlug('', '!!!')), true)
})
