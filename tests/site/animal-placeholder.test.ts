import assert from 'node:assert/strict'
import { test } from 'node:test'
import { animalPlaceholder, loadAnimalPlaceholder } from '../../src/lib/animal-placeholder'

test('a placeholder uses the approved asset and normal authenticated media upload', async () => {
  const calls: string[] = []
  const request: typeof fetch = async (url, options) => {
    calls.push(String(url))
    if (calls.length === 1) {
      assert.equal(url, animalPlaceholder.src)
      return new Response('approved image fixture', { headers: { 'Content-Type': 'image/webp' } })
    }
    assert.equal(url, '/cms-api/media')
    assert.equal(options?.method, 'POST')
    assert.equal(options?.credentials, 'same-origin')
    assert.ok(options?.body instanceof FormData)
    const file = options.body.get('file') as File
    assert.equal(file.name, animalPlaceholder.filename)
    assert.equal(file.type, 'image/webp')
    assert.equal(await file.text(), 'approved image fixture')
    assert.deepEqual(JSON.parse(String(options.body.get('_payload'))), { alt: animalPlaceholder.alt })
    return Response.json({ doc: { id: 'new-placeholder' } }, { status: 201 })
  }
  assert.equal(await loadAnimalPlaceholder('/cms-api', request), 'new-placeholder')
  assert.equal(calls.length, 2)
})

test('missing assets and denied uploads do not return a photo ID', async () => {
  for (const failure of [0, 1]) {
    let call = 0
    const request: typeof fetch = async () => {
      const step = call++
      if (step === failure) return new Response(null, { status: failure === 1 ? 403 : 503 })
      return new Response('image')
    }
    await assert.rejects(loadAnimalPlaceholder('/api', request), /Please try again/)
    assert.equal(call, failure + 1)
  }
})

test('different animals receive independent photo records from the same artwork', async () => {
  let created = 0
  const request: typeof fetch = async (_url, options) => options?.method === 'POST'
    ? Response.json({ doc: { id: ++created } }, { status: 201 })
    : new Response('approved artwork')
  assert.equal(await loadAnimalPlaceholder('/api', request), 1)
  assert.equal(await loadAnimalPlaceholder('/api', request), 2)
})
