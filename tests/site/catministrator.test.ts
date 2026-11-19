import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readModelDraftOutput } from '../../src/lib/catministrator/model'
import { DraftRequestError, parseDraftCommand } from '../../src/lib/catministrator/requests'
import { replyToTelegram } from '../../src/lib/catministrator/telegram'

test('Catministrator parses explicit changes and rejects fields outside its draft scope', () => {
  assert.deepEqual(parseDraftCommand('/edit Test Cat | status=pending | summary=A calm cat.'), {
    action: 'animal', animal: 'Test Cat', patch: { status: 'on-hold', summary: 'A calm cat.' },
  })
  assert.deepEqual(parseDraftCommand('/featured First, Second, Third'), {
    action: 'featured', animals: ['First', 'Second', 'Third'],
  })
  assert.throws(() => parseDraftCommand('/edit Test Cat | _status=published'), DraftRequestError)
  assert.throws(() => parseDraftCommand('/featured First, first'), DraftRequestError)
  assert.throws(() => parseDraftCommand('/featured One, Two, Three, Four'), DraftRequestError)
  assert.throws(() => readModelDraftOutput('{"action":"publish","animal":"Test Cat"}'))
  assert.throws(() => readModelDraftOutput('{"action":"animal","animal":"Test Cat","status":"deleted"}'), DraftRequestError)
})

const message = {
  chat: { id: 123, type: 'private' }, from: { id: 123 }, date: 1000, text: 'Feature First and Second.',
}
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
  assert.deepEqual(result, { chat: 123, text: 'Featured draft saved.\nReview in the CMS: https://example.invalid/admin/globals/homepage' })
})
