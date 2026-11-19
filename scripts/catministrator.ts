import path from 'node:path'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { setTimeout as pause } from 'node:timers/promises'
import type { SQLiteAdapter } from '@payloadcms/db-sqlite'
import { getPayload } from 'payload'
import { publishFeaturedDraft, saveCatministratorDraft, undoFeaturedPublication } from '../src/lib/catministrator/drafts'
import { isEditor, isTelegramUserID, linkedTelegramEditor } from '../src/lib/catministrator/editors'
import { hostedCatministratorCMS } from '../src/lib/catministrator/hosted-cms'
import { openAIInterpreter } from '../src/lib/catministrator/model'
import { DraftRequestError } from '../src/lib/catministrator/requests'
import { messageFromUpdate, replyToTelegram, telegramBot, type TelegramUpdate } from '../src/lib/catministrator/telegram'
import { legacyTelegramEditors, prepareTelegramUsers } from './telegram-users-schema'

const localDatabase = process.env.DATABASE_URL || 'file:./data/rescue.db'
if (!localDatabase.startsWith('file:') || process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN || process.env.VERCEL === '1') {
  throw new Error('Run the Catministrator pilot against the local Pets4Luv database.')
}
const [action, telegramID, email] = process.argv.slice(2)
if (action && (!['link', 'unlink'].includes(action) || !isTelegramUserID(telegramID) ||
    (action === 'link' && !email))) {
  throw new Error('Usage: ./scripts/local.sh catministrator -- link TELEGRAM_USER_ID PAYLOAD_EMAIL or unlink TELEGRAM_USER_ID')
}
const token = process.env.TELEGRAM_BOT_TOKEN
if (!action && (!token || !/^[0-9]+:[A-Za-z0-9_-]+$/.test(token))) {
  throw new Error('Run ./scripts/local.sh catministrator:setup to save your BotFather token.')
}

const stateDirectory = path.resolve('data/catministrator')
const controller = new AbortController()
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => controller.abort())

// The CMS owns schema initialization. This worker uses the same files without initiating migrations.
process.env.PAYLOAD_MIGRATING = 'true'
process.env.DISABLE_PAYLOAD_HMR = 'true'
const config = await (await import('../src/payload.config')).default
const payload = await getPayload({ config: { ...config, typescript: { ...config.typescript, autoGenerate: false } }, disableOnInit: true })
const client = (payload.db as unknown as SQLiteAdapter).client

async function readState(filename: string) {
  try {
    return await readFile(filename, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

async function writeState(filename: string, value: string) {
  const pending = filename + '.' + process.pid + '.tmp'
  await writeFile(pending, value, { mode: 0o600 })
  await rename(pending, filename)
}

type UndoState = { origin: string; token: string; lastAction: 'publish' | 'draft' }

async function recordLink(id: string, address: string) {
  const { docs: [editor] } = await payload.find({
    collection: 'users', where: { email: { equals: address.trim().toLowerCase() } }, limit: 1, depth: 0, overrideAccess: true,
  })
  if (!isEditor(editor)) throw new Error('No active editor or administrator matches that Payload email.')
  if (editor.telegramUserId === id) {
    console.log('That Telegram account is already linked.')
    return
  }
  const existing = await payload.count({ collection: 'users', where: { telegramUserId: { equals: id } }, overrideAccess: true })
  if (existing.totalDocs) throw new Error('This Telegram ID is already linked to a different account.')
  await payload.update({ collection: 'users', id: editor.id, overrideAccess: true, data: { telegramUserId: id } })
  console.log('Telegram account linked. Send a new /help to the bot to see the available commands.')
}

async function poll(botToken: string) {
  const call = telegramBot(botToken, controller.signal)
  const bot = await call<{ id: number; username: string }>('getMe')
  const webhook = await call<{ url: string }>('getWebhookInfo')
  if (webhook.url) throw new Error('The bot already has a webhook. Use a separate BotFather bot for the local pilot.')
  await mkdir(stateDirectory, { recursive: true, mode: 0o700 })
  const offsetFile = path.join(stateDirectory, 'telegram-' + bot.id + '.offset')
  let offset = Number(await readState(offsetFile)) || 0
  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim()
  const apiKey = gatewayKey || process.env.OPENAI_API_KEY
  const model = gatewayKey ? undefined : process.env.CATMINISTRATOR_OPENAI_MODEL
  const requestLimit = Number(process.env.CATMINISTRATOR_AI_REQUEST_LIMIT)
  const interpret = process.env.AI_ENABLED === 'true' && apiKey && (gatewayKey || model) && Number.isSafeInteger(requestLimit) && requestLimit > 0
    ? openAIInterpreter({ apiKey, model, viaGateway: Boolean(gatewayKey), requestLimit, usageDirectory: path.join(stateDirectory, 'model-requests') })
    : undefined
  async function requireEditor(id: number, date: number) {
    const editor = await linkedTelegramEditor(payload, id, date)
    if (!editor) throw new DraftRequestError('This Telegram account can no longer edit the CMS.')
    return editor
  }

  const cms = process.env.CATMINISTRATOR_CMS_ORIGIN
    ? hostedCatministratorCMS(process.env.CATMINISTRATOR_CMS_ORIGIN, process.env.CATMINISTRATOR_CMS_KEY || '', process.env.CATMINISTRATOR_VERCEL_BYPASS)
    : {
      cmsOrigin: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
      isLinked: async (id: number, date: number) => Boolean(await linkedTelegramEditor(payload, id, date)),
      save: async (id: number, date: number, request: Parameters<typeof saveCatministratorDraft>[2]) => {
        const editor = await requireEditor(id, date)
        return saveCatministratorDraft(payload, editor, request)
      },
      publish: async (id: number, date: number, approval: string) => {
        const editor = await requireEditor(id, date)
        return publishFeaturedDraft(payload, editor, approval)
      },
      undo: async (id: number, date: number, approval: string) => {
        const editor = await requireEditor(id, date)
        return undoFeaturedPublication(payload, editor, approval)
      },
    }
  const undoFile = (id: number) => path.join(stateDirectory, 'telegram-' + bot.id + '-' + id + '.undo')
  async function recall(id: number): Promise<UndoState | undefined> {
    try {
      const contents = await readState(undoFile(id))
      if (!contents) return
      const data = JSON.parse(contents) as Partial<UndoState> | null
      if (data?.origin === cms.cmsOrigin && typeof data.token === 'string' &&
          (data.lastAction === 'publish' || data.lastAction === 'draft')) {
        return { origin: data.origin, token: data.token, lastAction: data.lastAction }
      }
    } catch {
      console.error('Catministrator could not read the publication receipt.')
    }
  }
  async function remember(id: number, state: UndoState) {
    await writeState(undoFile(id), JSON.stringify(state)).catch(() => {
      console.error('Catministrator could not save the publication receipt.')
    })
  }
  const handlers: Parameters<typeof replyToTelegram>[1] = {
    ...cms, interpret, onError: () => console.error('Catministrator CMS request failed.'),
    save: async (id, date, request) => {
      const result = await cms.save(id, date, request)
      if (result.changed) {
        const saved = await recall(id)
        if (saved?.lastAction === 'publish') await remember(id, { ...saved, lastAction: 'draft' })
      }
      return result
    },
    publish: async (id, date, approval) => {
      const result = await cms.publish(id, date, approval)
      if (result.undoToken) await remember(id, { origin: cms.cmsOrigin, token: result.undoToken, lastAction: 'publish' })
      return result
    },
    undo: async (id, date, { token, featured }) => {
      const saved = await recall(id)
      if (!token && !featured && saved?.lastAction === 'draft') {
        throw new DraftRequestError('Your last change was a draft. Open the CMS to review or discard it.')
      }
      const approval = token || saved?.token
      if (!approval) {
        throw new DraftRequestError('I don’t have a featured publication from this chat to undo. Open Versions in the CMS to review older orders.')
      }
      const result = await cms.undo(id, date, approval)
      if (saved?.token === approval) await rm(undoFile(id), { force: true }).catch(() => undefined)
      return result
    },
  }
  console.log(`Listening for private messages to @${bot.username}. AI interpretation is ${interpret ? 'enabled' : 'disabled'}.`)
  while (!controller.signal.aborted) {
    try {
      const updates = await call<TelegramUpdate[]>('getUpdates', {
        timeout: 25, limit: 1, offset, allowed_updates: ['message', 'callback_query'],
      }, 35000)
      for (const update of updates) {
        if (!Number.isSafeInteger(update.update_id) || update.update_id < offset) continue
        if (update.callback_query) {
          await call('answerCallbackQuery', { callback_query_id: update.callback_query.id }).catch(() => undefined)
        }
        const response = await replyToTelegram(messageFromUpdate(update), handlers)
        const nextOffset = update.update_id + 1
        await writeState(offsetFile, String(nextOffset))
        offset = nextOffset
        if (response) await call('sendMessage', {
          chat_id: response.chat, text: response.text, reply_markup: response.replyMarkup, link_preview_options: { is_disabled: true },
        })
      }
    } catch (error) {
      if (controller.signal.aborted) break
      if (error instanceof Error && error.message === 'Telegram getUpdates failed (HTTP 409).') throw error
      console.error('Telegram polling or reply failed. Retrying in five seconds.')
      await pause(5000, undefined, { signal: controller.signal }).catch(() => {})
    }
  }
}

try {
  await prepareTelegramUsers(client, legacyTelegramEditors)
  if (action === 'link') await recordLink(telegramID, email)
  else if (action === 'unlink') {
    const { docs: [editor] } = await payload.find({
      collection: 'users', where: { telegramUserId: { equals: telegramID } }, limit: 1, depth: 0, overrideAccess: true,
    })
    if (editor) await payload.update({ collection: 'users', id: editor.id, overrideAccess: true, data: { telegramUserId: null } })
    console.log('Telegram access revoked.')
  } else await poll(token!)
} catch (error) {
  // Network exceptions can include request details. Log our own safe messages only.
  if (!controller.signal.aborted) {
    const message = error instanceof Error && /^(No active editor|This Telegram ID|The bot already|Telegram \w+ failed \(HTTP)/.test(error.message)
      ? error.message : 'Catministrator could not start. Check your local CMS and bot settings.'
    console.error(message)
    process.exitCode = 1
  }
} finally {
  try { await payload.destroy() } finally { client.close() }
}
