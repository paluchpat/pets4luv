import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { openAIInterpreter, readModelDraftOutput } from '../../src/lib/catministrator/model'
import { AnimalNameError, DeleteRequestError, DraftRequestError, parseDraftCommand, type DraftRequest } from '../../src/lib/catministrator/requests'
import { createPhotoFlow, type PhotoWork } from '../../src/lib/catministrator/photo-flow'
import { combinePhotoUpdates, messageFromUpdate, replyToTelegram, type NameFollowUp } from '../../src/lib/catministrator/telegram'

test('Catministrator parses explicit changes and rejects fields outside its draft scope', () => {
  assert.deepEqual(parseDraftCommand('/edit Test Cat | status=pending | summary=A calm cat.'), {
    action: 'animal', animal: 'Test Cat', patch: { status: 'on-hold', summary: 'A calm cat.' },
  })
  assert.deepEqual(parseDraftCommand('/featured First, Second, Third'), {
    action: 'featured', animals: ['First', 'Second', 'Third'],
  })
  assert.deepEqual(parseDraftCommand('/lead Tiny'), { action: 'lead', animal: 'Tiny' })
  assert.deepEqual(readModelDraftOutput('{"action":"lead","animal":"Tiny"}'), { action: 'lead', animal: 'Tiny' })
  const replacement = { action: 'replace-featured', animal: 'Tiny', replacement: 'Mocachina' }
  assert.deepEqual(parseDraftCommand('/replace Tiny | Mocachina'), replacement)
  assert.deepEqual(readModelDraftOutput(JSON.stringify(replacement)), replacement)
  assert.throws(() => parseDraftCommand('/replace Tiny'), DraftRequestError)
  assert.throws(() => parseDraftCommand('/edit Test Cat | _status=published'), DraftRequestError)
  assert.throws(() => parseDraftCommand('/featured First, first'), DraftRequestError)
  assert.throws(() => parseDraftCommand('/featured One, Two, Three, Four'), DraftRequestError)
  assert.throws(() => readModelDraftOutput('{"action":"publish","animal":"Test Cat"}'))
  assert.throws(() => readModelDraftOutput('{"action":"animal","animal":"Test Cat","status":"deleted"}'), DraftRequestError)
})

const message = {
  chat: { id: 123, type: 'private' }, from: { id: 123 }, date: 1000, text: 'Feature First and Second.',
}

test('the Vercel Gateway uses Luna at medium effort and respects the request cap', async t => {
  const usageDirectory = await mkdtemp(path.join(tmpdir(), 'catministrator-model-'))
  t.after(() => rm(usageDirectory, { recursive: true, force: true }))
  const gateway = t.mock.method(globalThis, 'fetch', async (url: string, options?: RequestInit) => {
    assert.equal(url, 'https://ai-gateway.vercel.sh/v1/responses')
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer gateway-fixture-key')
    const body = JSON.parse(String(options?.body))
    assert.equal(body.model, 'openai/gpt-6-luna')
    assert.deepEqual(body.reasoning, { effort: 'medium' })
    assert.equal(body.input, message.text)
    assert.equal(body.text.format.strict, true)
    return Response.json({ status: 'completed', output: [{
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify({ action: 'featured', animals: ['First', 'Second'] }) }],
    }] })
  })
  const interpret = openAIInterpreter({ apiKey: 'gateway-fixture-key', viaGateway: true, requestLimit: 1, usageDirectory })
  assert.deepEqual(await interpret(message.text), { action: 'featured', animals: ['First', 'Second'] })
  await assert.rejects(() => interpret(message.text), /request limit/)
  assert.equal(gateway.mock.callCount(), 1)
})

test('Telegram accounts must be linked and messages must be private before invoking AI or the CMS', async () => {
  const handlers = {
    cmsOrigin: 'https://example.invalid',
    isLinked: async () => false,
    interpret: async () => { throw new Error('Unexpected model call') },
    save: async () => { throw new Error('Unexpected draft save') },
    onError: () => assert.fail('Authorization should not call the model or CMS'),
  }
  const denied = await replyToTelegram(message, handlers)
  assert.match(denied?.text || '', /needs to be linked/)
  assert.match((await replyToTelegram({ ...message, text: '/start' }, handlers))?.text || '', /user ID is 123/)
  assert.equal(await replyToTelegram({ ...message, chat: { ...message.chat, type: 'group' } }, handlers), undefined)
  assert.equal(await replyToTelegram({ ...message, from: { id: 456 } }, handlers), undefined)
})

test('a linked editor can send a draft command with a CMS review link', async () => {
  const result = await replyToTelegram({ ...message, text: '/featured First, Second' }, {
    cmsOrigin: 'https://example.invalid',
    isLinked: async (id, date) => id === 123 && date === 1000,
    save: async (id, date, command) => {
      assert.equal(id, 123)
      assert.equal(date, 1000)
      assert.deepEqual(command, { action: 'featured', animals: ['First', 'Second'] })
      return { message: 'Featured draft saved.', path: '/admin/globals/homepage' }
    },
    onError: () => assert.fail('The request should have succeeded'),
  })
  assert.deepEqual(result, {
    chat: 123, text: 'Featured draft saved.',
    replyMarkup: { inline_keyboard: [[{ text: 'Review in the CMS', url: 'https://example.invalid/admin/globals/homepage' }]] },
  })
})


test('deletion requests get the CMS login link and never save a draft', async () => {
  const handlers = {
    cmsOrigin: 'https://example.invalid',
    isLinked: async () => true,
    save: async () => assert.fail('A delete request must never call the CMS'),
    interpret: async () => { throw new DeleteRequestError() },
    onError: () => assert.fail('A delete request should have a specific response'),
  }
  for (const text of ['/delete Fig', 'Please delete Fig', 'Can you remove Fig’s profile permanently?']) {
    const result = await replyToTelegram({ ...message, text }, handlers)
    assert.match(result?.text || '', /Deleting is currently unavailable in Catministrator/)
    assert.deepEqual(result?.replyMarkup?.inline_keyboard, [[{ text: 'Log in to the CMS', url: 'https://example.invalid/admin/login' }]])
  }
})


test('local previews and review links use clickable loopback URLs', async () => {
  const { replyMarkup } = (await replyToTelegram({ ...message, text: '/lead Tiny' }, {
    cmsOrigin: 'http://localhost:3000',
    isLinked: async () => true,
    save: async () => ({
      message: 'Featured draft saved.', path: '/admin/globals/homepage',
      review: { previewToken: 'preview-token', publishToken: 'publish-token' },
    }),
    publish: async () => assert.fail('Saving a draft must not publish it'),
    onError: () => assert.fail('The request should have succeeded'),
  }))!
  assert.deepEqual(replyMarkup?.inline_keyboard, [
    [{ text: 'Preview homepage', url: 'http://127.0.0.1:3000/preview/featured/preview-token' }],
    [{ text: 'Publish this draft', callback_data: '/publish publish-token' }],
    [{ text: 'Review in the CMS', url: 'http://127.0.0.1:3000/admin/globals/homepage' }],
  ])
})


test('the featured publication reply offers Undo and plain-language undo bypasses the model', async () => {
  const requests: { token?: string; featured: boolean }[] = []
  const handlers = {
    cmsOrigin: 'https://example.invalid',
    isLinked: async (id: number) => id === 123,
    save: async () => assert.fail('Undo must not save an unrelated draft'),
    interpret: async () => assert.fail('Undo should skip the model'),
    publish: async () => ({ message: 'Featured animals published.', path: '/', undoToken: 'signed-undo' }),
    undo: async (_id: number, _date: number, request: { token?: string; featured: boolean }) => {
      requests.push(request)
      return { message: 'Restored the previous featured order.', path: '/' }
    },
    onError: () => assert.fail('The request should be handled'),
  }
  const published = await replyToTelegram({ ...message, text: '/publish approval' }, handlers)
  const undoButton = published?.replyMarkup?.inline_keyboard[1]?.[0]
  assert.equal(undoButton?.text, 'Undo featured publish')
  for (const text of ['undo last action', 'undo publishing new featured animals order']) {
    assert.match((await replyToTelegram({ ...message, text }, handlers))?.text || '', /Restored/)
  }
  const callback = { id: 'click', from: message.from, message, data: undoButton?.callback_data }
  await replyToTelegram(messageFromUpdate({ update_id: 1, callback_query: callback }), handlers)
  await replyToTelegram(messageFromUpdate({ update_id: 2, callback_query: { ...callback, from: { id: 99 } } }), handlers)
  assert.deepEqual(requests, [
    { featured: false },
    { featured: true },
    { token: 'signed-undo', featured: true },
  ])
})


test('a suggested name or typed correction resumes the original draft in the same Telegram chat', async () => {
  const pending = new Map<number, NameFollowUp>()
  const saves: DraftRequest[] = []
  let modelCalls = 0
  const initial = { ...message, text: 'Feature Fig first, then bandit then mocha' }
  const handlers = {
    cmsOrigin: 'https://example.invalid',
    isLinked: async () => true,
    nameFollowUps: {
      load: async (id: number) => pending.get(id),
      store: async (id: number, followUp?: NameFollowUp) => {
        if (followUp) pending.set(id, followUp)
        else pending.delete(id)
      },
    },
    interpret: async (text: string) => {
      assert.equal(text, initial.text)
      modelCalls++
      return parseDraftCommand('/featured Fig, bandit, mocha')!
    },
    save: async (_id: number, _date: number, request: DraftRequest, version?: string | null) => {
      if (version === undefined) throw new AnimalNameError('I couldn’t find “mocha”.', {
        field: 2, reference: 'mocha', suggestions: [{ name: 'Mochachina', slug: 'mochachina' }], featuredVersion: 'current-version',
      })
      assert.equal(version, 'current-version')
      saves.push(request)
      return { message: 'Featured animals draft saved.', path: '/admin/globals/homepage' }
    },
    onError: () => assert.fail('The correction should be handled'),
  }
  const suggestion = await replyToTelegram(initial, handlers)
  assert.match(suggestion?.text || '', /Did you mean Mochachina/)
  assert.equal(suggestion?.replyMarkup?.inline_keyboard[0][0].text, 'Mochachina')
  assert.deepEqual(saves, [])

  const other = { ...message, from: { id: 456 }, chat: { id: 456, type: 'private' }, text: 'I meant Mochachina' }
  assert.match((await replyToTelegram(other, handlers))?.text || '', /Send the draft request again/)
  assert.match((await replyToTelegram({ ...message, text: '/name stale 0' }, handlers))?.text || '', /out of date/)
  const completed = await replyToTelegram({ ...message, text: 'I meant mochachina' }, handlers)
  assert.match(completed?.text || '', /draft saved/)
  assert.deepEqual(saves, [{ action: 'featured', animals: ['Fig', 'bandit', 'slug:mochachina'] }])
  assert.equal(modelCalls, 1)
  assert.equal(pending.size, 0)

  const retry = await replyToTelegram(initial, handlers)
  const callback = { id: 'tap', from: message.from, message, data: retry?.replyMarkup?.inline_keyboard[0][0].callback_data }
  assert.match((await replyToTelegram(messageFromUpdate({ update_id: 9, callback_query: callback }), handlers))?.text || '', /draft saved/)
  assert.equal(saves.length, 2)
  assert.equal(modelCalls, 2)
  await replyToTelegram(initial, handlers)
  assert.match((await replyToTelegram({ ...message, text: '/cancel' }, handlers))?.text || '', /clarification canceled/)
  assert.equal(pending.size, 0)
})


test('a textless Telegram album gets a reply and the chosen profile is saved only after confirmation', async () => {
  const original = { chat: message.chat, from: message.from, date: message.date }
  const first = { file_id: 'large-1', file_unique_id: 'photo-1' }
  const second = { file_id: 'large-2', file_unique_id: 'photo-2' }
  const [album] = combinePhotoUpdates([
    { update_id: 1, message: { ...original, media_group_id: 'album', photo: [{ file_id: 'small', file_unique_id: 'small-1' }, first] } },
    { update_id: 2, message: { ...original, media_group_id: 'album', photo: [second] } },
  ])
  assert.equal(album.update_id, 2)
  let stored: PhotoWork | undefined
  const downloaded: string[] = []
  let allowed = false
  const photoFlow = createPhotoFlow({
    load: async () => stored,
    store: async (_id, work) => { stored = work },
    isLinked: async () => allowed,
    find: async (_id, _date, name) => {
      assert.equal(name, 'Fig')
      return { id: 7, name }
    },
    download: async file => {
      downloaded.push(file.file_id)
      return { digest: file.file_id, data: Buffer.from(file.file_id) }
    },
    save: async (_id, _date, plan, images) => {
      assert.deepEqual(plan, { kind: 'update', id: 7, name: 'Fig', fields: undefined })
      assert.deepEqual(images.map(image => image.digest), ['large-1', 'large-2'])
      return { message: 'Draft saved for Fig.', path: '/admin/collections/animals/7' }
    },
    onError: () => assert.fail('Photo flow failed'),
  })
  const handlers = {
    cmsOrigin: 'https://example.invalid', photoFlow,
    isLinked: async () => allowed,
    save: async () => assert.fail('Expected the photo flow to handle this request'),
    onError: () => assert.fail('Telegram request failed'),
  }
  assert.match((await replyToTelegram(messageFromUpdate(album), handlers))?.text || '', /needs to be linked/)
  assert.equal(stored, undefined)
  allowed = true
  const receipt = await replyToTelegram(messageFromUpdate(album), handlers)
  assert.match(receipt?.text || '', /received 2 photos.*animal’s name/)
  const proposed = await replyToTelegram({ ...original, text: 'Can you add these photos to Fig’s profile?' }, handlers)
  assert.match(proposed?.text || '', /Save to Fig’s draft/)
  assert.deepEqual(downloaded, [])
  const button = proposed?.replyMarkup?.inline_keyboard[0][0]
  assert.equal(button?.text, 'Save animal draft')
  const result = await replyToTelegram(messageFromUpdate({
    update_id: 3, callback_query: { id: 'save', from: original.from, message: original, data: button?.callback_data },
  }), handlers)
  assert.match(result?.text || '', /Draft saved for Fig/)
  assert.equal(result?.replyMarkup?.inline_keyboard[0][0].url, 'https://example.invalid/admin/collections/animals/7')
  assert.equal(stored, undefined)
})

test('reading an intake flyer extracts facts without uploading the reference image', async () => {
  let stored: PhotoWork | undefined
  const flow = createPhotoFlow({
    load: async () => stored,
    store: async (_id, work) => { stored = work },
    isLinked: async () => true,
    find: async () => { throw new AnimalNameError('Unknown animal', { reference: 'Willow', field: 'animal', suggestions: [] }) },
    download: async () => ({ digest: 'flyer', data: Buffer.from('reference image') }),
    read: async images => {
      assert.equal(images[0].digest, 'flyer')
      return { name: 'Willow', species: 'cat', sex: 'female', summary: 'A gentle kitten.' }
    },
    save: async (_id, _date, plan, images) => {
      assert.deepEqual(plan, { kind: 'create', fields: { name: 'Willow', species: 'cat', sex: 'female', summary: 'A gentle kitten.' } })
      assert.deepEqual(images, [])
      return { message: 'Draft saved for Willow.', path: '/admin/collections/animals/1' }
    },
    onError: () => assert.fail('Photo flow failed'),
  })
  const photo = { id: 123, date: 1000, text: '', photos: [{ file_id: 'flyer', file_unique_id: 'flyer' }] }
  const received = await flow(photo)
  assert.ok(received && 'text' in received)
  const read = received.buttons?.[0][0]
  assert.equal(read?.text, 'Read details from image')
  const details = await flow({ ...photo, text: read!.callback_data, photos: [] })
  assert.ok(details && 'text' in details)
  assert.match(details.text, /Willow.*female[\s\S]*gentle kitten/)
  assert.deepEqual(stored?.files, [])
  const save = details.buttons?.[0][0]
  assert.equal(save?.text, 'Create animal draft')
  const result = await flow({ ...photo, text: save!.callback_data, photos: [] })
  assert.ok(result && 'draft' in result)
  assert.match(result.draft.message, /Draft saved for Willow/)
})
