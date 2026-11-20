import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { openAIInterpreter, readModelDecision, type ModelInput, type ModelDecision, type IntakeDecision } from '../../src/lib/catministrator/model'
import { AnimalNameError, DeleteRequestError, DraftRequestError, parseDraftCommand, type DraftRequest } from '../../src/lib/catministrator/requests'
import { readIntakeDetails } from '../../src/lib/catministrator/animal-intake'
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
  assert.deepEqual(readModelDecision('{"action":"lead","animal":"Tiny"}'), { action: 'lead', animal: 'Tiny' })
  const replacement = { action: 'replace-featured', animal: 'Tiny', replacement: 'Mocachina' }
  assert.deepEqual(parseDraftCommand('/replace Tiny | Mocachina'), replacement)
  assert.deepEqual(readModelDecision(JSON.stringify(replacement)), replacement)
  assert.throws(() => parseDraftCommand('/replace Tiny'), DraftRequestError)
  assert.throws(() => parseDraftCommand('/edit Test Cat | _status=published'), DraftRequestError)
  assert.throws(() => parseDraftCommand('/featured First, first'), DraftRequestError)
  assert.throws(() => parseDraftCommand('/featured One, Two, Three, Four'), DraftRequestError)
  assert.throws(() => readModelDecision('{"action":"publish","animal":"Test Cat"}'))
  assert.throws(() => readModelDecision('{"action":"animal","animal":"Test Cat","status":"deleted"}'), DraftRequestError)
})

const message = {
  chat: { id: 123, type: 'private' }, from: { id: 123 }, date: 1000, text: 'Feature First and Second.',
}

test('the Vercel Gateway sends a caption and all five images to Luna together', async t => {
  const usageDirectory = await mkdtemp(path.join(tmpdir(), 'catministrator-model-'))
  t.after(() => rm(usageDirectory, { recursive: true, force: true }))
  const gateway = t.mock.method(globalThis, 'fetch', async (url: string, options?: RequestInit) => {
    assert.equal(url, 'https://ai-gateway.vercel.sh/v1/responses')
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer gateway-fixture-key')
    const body = JSON.parse(String(options?.body))
    assert.equal(body.model, 'openai/gpt-6-luna')
    assert.deepEqual(body.reasoning, { effort: 'medium' })
    const content = body.input[0].content
    assert.equal(JSON.parse(content[0].text).message, 'add this cat')
    assert.equal(content.filter((part: {type: string}) => part.type === 'input_image').length, 5)
    assert.equal(body.text.format.strict, true)
    return Response.json({ status: 'completed', output: [{
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify({ action: 'create-animal', name: 'Willow', species: 'cat', attachments: ['photo', 'photo', 'photo', 'photo', 'reference'] }) }],
    }] })
  })
  const interpret = openAIInterpreter({ apiKey: 'gateway-fixture-key', viaGateway: true, requestLimit: 1, usageDirectory })
  const photos = Array.from({ length: 5 }, (_, index) => ({ data: Buffer.from('test-' + index), digest: String(index) }))
  const input = { text: 'add this cat', images: photos }
  assert.deepEqual(await interpret(input), {
    action: 'create-animal', animal: undefined, details: { name: 'Willow', species: 'cat' },
    attachments: ['photo', 'photo', 'photo', 'photo', 'reference'],
  })
  assert.deepEqual(readModelDecision('{"action":"create-animal","attachments":["photo"]}', 2),
    { action: 'create-animal', animal: undefined, details: {}, attachments: ['unknown', 'unknown'] })
  await assert.rejects(() => interpret(input), /request limit/)
  assert.equal(gateway.mock.callCount(), 1)
})

test('Luna intake keeps supported coat tags with high confidence in the proposed order', () => {
  const decision = readModelDecision(JSON.stringify({
    action: 'create-animal', name: 'Willow', species: 'cat',
    colors: [
      { tag: 'white', confidence: 'high', evidence: 'White belly and legs in photo 1.' },
      { tag: 'gray', confidence: 'uncertain', evidence: 'Highlight on black fur in photo 1.' },
      { tag: 'black', confidence: 'high', evidence: 'Black patches across the back in photo 1.' },
      { tag: 'brown', confidence: 'high', evidence: ' ' },
      { tag: 'tuxedo', confidence: 'high', evidence: 'Intake form explicitly reports a tuxedo pattern.' },
      'tan',
    ],
  }))
  assert.ok('details' in decision)
  assert.deepEqual(decision.details.colors, ['white', 'black', 'tuxedo'])
})

test('intake values use CMS choices and preserve only valid fields', () => {
  assert.deepEqual(readIntakeDetails({
    name: ' Will ', estimatedBirthDate: '2026-04-10', weight: 6.8, size: 'small', status: 'available',
    colors: ['white', 'black', 'tuxedo', 'white', 'unsupported-color'],
    compatibility: { cats: 'yes', dogs: null, children: 'unknown' },
    rescueIntakeID: ' FIXTURE-2001 ', internalNotes: 'Vaccination record verified.',
    careNeeds: 'Offer unscented litter.', compatibilityNotes: 'Friendly with other cats.',
  }, new Date('2026-11-20T12:00:00Z')), {
    name: 'Will', estimatedBirthDate: '2026-04-10', ageGroup: 'baby', weight: 6.8, size: 'small', status: 'available',
    colors: ['white', 'black', 'tuxedo'], compatibility: { cats: 'yes' },
    rescueIntakeID: 'FIXTURE-2001', internalNotes: 'Vaccination record verified.',
    careNeeds: 'Offer unscented litter.', compatibilityNotes: 'Friendly with other cats.',
  })
  assert.deepEqual(readIntakeDetails({
    estimatedBirthDate: '2025-02-29', weight: 'six', status: 'quarantine', colors: ['unspecified'],
    compatibility: { cats: null, dogs: 'unknown', children: false },
  }), {})
})

test('Telegram accounts must be linked and messages must be private before invoking AI or the CMS', async () => {
  const handlers = {
    cmsOrigin: 'https://example.invalid',
    isLinked: async () => false,
    interpret: async () => { throw new Error('Unexpected model call') },
    sendTyping: async () => assert.fail('Unlinked senders should not receive a typing indicator'),
    save: async () => { throw new Error('Unexpected draft save') },
    onError: () => assert.fail('Authorization should not call the model or CMS'),
  }
  const denied = await replyToTelegram(message, handlers)
  assert.match(denied?.text || '', /Give it to a Pets4Luv administrator/)
  assert.match((await replyToTelegram({ ...message, text: '/start' }, handlers))?.text || '', /user ID is 123/)
  assert.equal(await replyToTelegram({ ...message, chat: { ...message.chat, type: 'group' } }, handlers), undefined)
  assert.equal(await replyToTelegram({ ...message, from: { id: 456 } }, handlers), undefined)
})

test('Telegram refreshes the typing indicator while Luna is working and cancels it before the reply', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  const signals: AbortSignal[] = []
  const modelStarted = Promise.withResolvers<void>()
  const modelReply = Promise.withResolvers<ModelDecision>()
  const request = replyToTelegram(message, {
    cmsOrigin: 'https://example.invalid',
    isLinked: async () => true,
    sendTyping: async (id, signal) => {
      assert.equal(id, message.chat.id)
      signals.push(signal)
      throw new Error('The optional typing update failed')
    },
    interpret: () => {
      modelStarted.resolve()
      return modelReply.promise
    },
    save: async () => assert.fail('A conversational reply cannot save a draft'),
    onError: () => assert.fail('Typing updates should not interrupt a reply'),
  })

  await modelStarted.promise
  assert.equal(signals.length, 1)
  assert.equal(signals[0].aborted, false)
  t.mock.timers.tick(4000)
  assert.equal(signals.length, 2)
  modelReply.resolve({ action: 'reply', message: 'Finished.' })
  assert.equal((await request)?.text, 'Finished.')
  assert.equal(signals[0].aborted, true)
  t.mock.timers.tick(8000)
  assert.equal(signals.length, 2)
})

test('Catministrator asks the model to respond to greetings, help, and check-ins', async () => {
  const handlers = {
    cmsOrigin: 'https://example.invalid',
    isLinked: async () => true,
    interpret: async ({ text }: ModelInput) => {
      passed.push(text)
      return { action: 'reply', message: 'What would you like to update?' } as const
    },
    save: async () => assert.fail('Greetings should not save a draft'),
    onError: () => assert.fail('Greeting should succeed'),
  }
  const prompts = ['/start', '/help', 'Hello!', 'What can you do?', 'Are you alive?']
  const passed: string[] = []
  for (const text of prompts) {
    const reply = await replyToTelegram({ ...message, text }, handlers)
    assert.match(reply?.text || '', /Tell me what you’d like to update|What would you like to update/)
    assert.doesNotMatch(reply?.text || '', /\/[a-z]+/i)
  }
  assert.deepEqual(passed, prompts)
})

test('Catministrator accepts a spoken-style edit and links to the CMS when text drafting is unavailable', async () => {
  const text = 'Could you mark Tiny as pending?'
  const receipt = { message: 'Draft saved for Tiny.', path: '/admin/collections/animals/8' }
  const draft = { action: 'animal', animal: 'Tiny', patch: { status: 'on-hold' } } as const
  const handlers = {
    cmsOrigin: 'https://example.invalid',
    isLinked: async () => true,
    save: async (_id: number, _date: number, request: DraftRequest) => {
      assert.deepEqual(request, draft)
      return receipt
    },
    onError: () => assert.fail('Draft reply should succeed'),
  }
  const input = { ...message, text }
  const ready = await replyToTelegram(input, {
    ...handlers,
    interpret: async request => {
      assert.equal(request.text, text)
      return draft
    },
  })
  assert.equal(ready?.text, receipt.message)
  const unavailable = await replyToTelegram(input, handlers)
  assert.match(unavailable?.text || '', /currently unavailable/)
  assert.doesNotMatch(unavailable?.text || '', /\/[a-z]+/i)
  assert.equal(unavailable?.replyMarkup?.inline_keyboard[0][0].url, 'https://example.invalid/admin')
})

test('a linked editor can send a draft command with a CMS review link', async () => {
  const result = await replyToTelegram({ ...message, text: '/featured First, Second' }, {
    cmsOrigin: 'https://example.invalid',
    isLinked: async (id, date) => id === 123 && date === 1000,
    interpret: async ({ text }) => {
      assert.equal(text, '/featured First, Second')
      return { action: 'featured', animals: ['First', 'Second'] }
    },
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
    interpret: async () => ({ action: 'lead', animal: 'Tiny' }),
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


test('typed undo is interpreted and publish approval requires a genuine Telegram callback', async () => {
  const requests: { token?: string; featured: boolean }[] = []
  const handlers = {
    cmsOrigin: 'https://example.invalid',
    isLinked: async (id: number) => id === 123,
    save: async () => assert.fail('Undo must not save an unrelated draft'),
    interpret: async ({ text }: ModelInput): Promise<ModelDecision> => text.startsWith('/publish')
      ? { action: 'reply', message: 'Tap Publish this draft on the proposal.' }
      : { action: text === 'undo last action' ? 'undo' : 'undo-featured' },
    publish: async () => ({ message: 'Featured animals published.', path: '/', undoToken: 'signed-undo' }),
    undo: async (_id: number, _date: number, request: { token?: string; featured: boolean }) => {
      requests.push(request)
      return { message: 'Restored the previous featured order.', path: '/' }
    },
    onError: () => assert.fail('The request should be handled'),
  }
  assert.match((await replyToTelegram({ ...message, text: '/publish approval' }, handlers))?.text || '', /Tap Publish/)
  const published = await replyToTelegram(messageFromUpdate({
    update_id: 0, callback_query: { id: 'publish', from: message.from, message, data: '/publish approval' },
  }), handlers)
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
    interpret: async ({ text, context }: ModelInput): Promise<ModelDecision> => {
      modelCalls++
      if (text === initial.text) return { action: 'featured', animals: ['Fig', 'bandit', 'mocha'] }
      if (text === 'Never mind.') return { action: 'cancel' }
      if (context?.nameCorrection) return { action: 'correct-name', animal: 'slug:mochachina' }
      return { action: 'reply', message: 'Send the draft request again.' }
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
  assert.match((await replyToTelegram(messageFromUpdate({
    update_id: 8, callback_query: { id: 'old', from: message.from, message, data: '/name stale 0' },
  }), handlers))?.text || '', /out of date/)
  const completed = await replyToTelegram({ ...message, text: 'I meant mochachina' }, handlers)
  assert.match(completed?.text || '', /draft saved/)
  assert.deepEqual(saves, [{ action: 'featured', animals: ['Fig', 'bandit', 'slug:mochachina'] }])
  assert.equal(modelCalls, 3)
  assert.equal(pending.size, 0)

  const retry = await replyToTelegram(initial, handlers)
  const callback = { id: 'tap', from: message.from, message, data: retry?.replyMarkup?.inline_keyboard[0][0].callback_data }
  assert.match((await replyToTelegram(messageFromUpdate({ update_id: 9, callback_query: callback }), handlers))?.text || '', /draft saved/)
  assert.equal(saves.length, 2)
  assert.equal(modelCalls, 4)
  await replyToTelegram(initial, handlers)
  assert.match((await replyToTelegram({ ...message, text: 'Never mind.' }, handlers))?.text || '', /cleared the pending request/)
  assert.equal(pending.size, 0)
})


test('the mixed album goes to the model after authorization and only its public photos are saved', async () => {
  const files = Array.from({ length: 5 }, (_, index) => ({ file_id: 'file-' + index, file_unique_id: 'photo-' + index }))
  const original = { chat: message.chat, from: message.from, date: message.date }
  const [album] = combinePhotoUpdates(files.map((file, index) => ({
    update_id: index + 1,
    message: { ...original, media_group_id: 'album', photo: [file],
      ...(index === 0 && { caption: 'add this cat' }) },
  })))
  assert.equal(album.update_id, 5)
  let stored: PhotoWork | undefined
  let allowed = false
  let saved = false
  let calls = 0
  const details = { name: 'Willow', species: 'cat', summary: 'Quiet and affectionate.', weight: 6.8,
    colors: ['white', 'black', 'tuxedo'], compatibility: { cats: 'yes' }, internalNotes: 'Vaccination record verified.',
    rescueIntakeID: 'FIXTURE-2001' } satisfies IntakeDecision['details']
  const downloaded: string[] = []
  const photoFlow = createPhotoFlow({
    load: async () => {
      assert.ok(allowed, 'Unlinked messages must not read photo state')
      return stored
    },
    store: async (_id, work) => { stored = work },
    isLinked: async () => allowed,
    find: async () => assert.fail('New intake must not search for an existing animal'),
    download: async file => {
      assert.ok(allowed, 'Unlinked messages must not download images')
      downloaded.push(file.file_id)
      return { digest: file.file_id, data: Buffer.from(file.file_id) }
    },
    save: async (_id, _date, plan, images) => {
      assert.deepEqual(plan, { kind: 'create', fields: details })
      assert.deepEqual(images.map(image => image.digest), ['file-0', 'file-1', 'file-2', 'file-3'])
      saved = true
      return { message: 'Draft saved for Willow.', path: '/admin/collections/animals/7' }
    },
  })
  const handlers = {
    cmsOrigin: 'https://example.invalid', photoFlow,
    isLinked: async () => allowed,
    interpret: async ({ text, images }: ModelInput): Promise<ModelDecision> => {
      assert.ok(allowed, 'Unlinked messages must not use AI')
      assert.equal(text, 'add this cat')
      assert.deepEqual(images.map(image => image.digest), files.map(file => file.file_id))
      calls++
      return { action: 'create-animal', details,
        attachments: ['photo', 'photo', 'photo', 'photo', 'reference'] }
    },
    save: async () => assert.fail('Expected the intake flow'),
    onError: () => assert.fail('Telegram request failed'),
  }
  assert.match((await replyToTelegram(messageFromUpdate(album), handlers))?.text || '', /Give it to a Pets4Luv administrator/)
  assert.equal(calls, 0)
  assert.equal(stored, undefined)
  assert.deepEqual(downloaded, [])
  allowed = true
  const proposed = await replyToTelegram(messageFromUpdate(album), handlers)
  assert.match(proposed?.text || '', /Create an animal draft for Willow/)
  assert.match(proposed?.text || '', /Website photos: 1, 2, 3, 4/)
  assert.match(proposed?.text || '', /Reference images kept out of the gallery: 5/)
  assert.match(proposed?.text || '', /Coat: White, Black, Tuxedo/)
  assert.match(proposed?.text || '', /6.8 lb/)
  assert.match(proposed?.text || '', /Compatibility: cats yes/)
  assert.match(proposed?.text || '', /Staff only · Intake ID: FIXTURE-2001/)
  assert.equal(saved, false)
  const button = proposed?.replyMarkup?.inline_keyboard[0][0]
  const result = await replyToTelegram(messageFromUpdate({
    update_id: 6, callback_query: { id: 'save', from: original.from, message: original, data: button?.callback_data },
  }), handlers)
  assert.match(result?.text || '', /Draft saved for Willow/)
  assert.equal(calls, 1)
  assert.equal(saved, true)
  assert.equal(stored, undefined)
  assert.deepEqual(downloaded, [...files.map(file => file.file_id), 'file-0', 'file-1', 'file-2', 'file-3'])
})

test('replying with a missing name resumes the same intake with the album still in context', async () => {
  let stored: PhotoWork | undefined
  const photoFlow = createPhotoFlow({
    load: async () => stored,
    store: async (_id, work) => { stored = work },
    isLinked: async () => true,
    download: async file => ({ digest: file.file_id, data: Buffer.from(file.file_id) }),
    save: async () => assert.fail('Intake still needs approval'),
  })
  const handlers = {
    cmsOrigin: 'https://example.invalid', photoFlow,
    isLinked: async () => true,
    interpret: async ({ text, images, context }: ModelInput): Promise<ModelDecision> => {
      assert.equal(images.length, 1)
      if (!text) return { action: 'reply', message: 'What would you like me to do with this photo?' }
      if (text === 'Add this cat') return { action: 'create-animal', details: { species: 'cat' }, attachments: ['photo'] }
      assert.equal(text, 'Her name is Willow')
      assert.deepEqual((context?.photoIntake as {details?: unknown}).details, { species: 'cat' })
      return { action: 'create-animal', details: { name: 'Willow', species: 'cat' }, attachments: ['photo'] }
    },
    save: async () => assert.fail('Expected intake'),
    onError: () => assert.fail('Telegram request failed'),
  }
  const { text: _text, ...original } = message
  assert.match((await replyToTelegram({ ...original, photo: [{ file_id: 'cat', file_unique_id: 'cat' }] }, handlers))?.text || '', /this photo/)
  assert.match((await replyToTelegram({ ...original, text: 'Add this cat' }, handlers))?.text || '', /cat’s name/)
  const proposal = await replyToTelegram({ ...original, text: 'Her name is Willow' }, handlers)
  assert.match(proposal?.text || '', /Create an animal draft for Willow/)
  assert.equal(proposal?.replyMarkup?.inline_keyboard[0][0].text, 'Create animal draft')
})


test('an editor can ask for an existing animal preview and publish only using its signed button', async () => {
  let published = 0
  const handlers = {
    cmsOrigin: 'https://example.invalid',
    isLinked: async () => true,
    interpret: async (input: ModelInput): Promise<ModelDecision> => {
      assert.match(input.text, /Rowan|publish/)
      return { action: 'review-animal', animal: 'Rowan' }
    },
    reviewAnimal: async (_id: number, _date: number, name: string) => {
      assert.equal(name, 'Rowan')
      return { message: 'Here’s the draft for Rowan.', path: '/admin/collections/animals/9',
        review: { kind: 'animal' as const, animal: 'Rowan', previewToken: 'preview', publishToken: 'approval', missing: [] } }
    },
    save: async () => assert.fail('Preview does not save a draft'),
    publish: async (_id: number, _date: number, token: string) => {
      assert.equal(token, 'approval')
      published++
      return { message: 'Rowan’s profile is published.', path: '/animals/rowan' }
    },
    onError: () => assert.fail('Animal review error'),
  }
  const reply = await replyToTelegram({ ...message, text: 'Preview Rowan' }, handlers)
  assert.equal(reply?.replyMarkup?.inline_keyboard[0][0].url, 'https://example.invalid/preview/animal/preview')
  const publish = reply?.replyMarkup?.inline_keyboard[1][0]
  assert.equal(publish?.text, 'Publish this draft')
  await replyToTelegram({ ...message, text: '/publish approval' }, handlers)
  assert.equal(published, 0)
  const result = await replyToTelegram(messageFromUpdate({
    update_id: 1, callback_query: { id: 'tap', from: message.from, message, data: publish?.callback_data },
  }), handlers)
  assert.equal(published, 1)
  assert.deepEqual(result?.replyMarkup?.inline_keyboard, [[{ text: 'View animal profile', url: 'https://example.invalid/animals/rowan' }]])
})
