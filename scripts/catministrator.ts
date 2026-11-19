import path from 'node:path'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { setTimeout as pause } from 'node:timers/promises'
import type { SQLiteAdapter } from '@payloadcms/db-sqlite'
import { getPayload } from 'payload'
import { saveCatministratorDraft } from '../src/lib/catministrator/drafts'
import { isEditor, isTelegramUserID, linkedTelegramEditor } from '../src/lib/catministrator/editors'
import { openAIInterpreter } from '../src/lib/catministrator/model'
import { DraftRequestError } from '../src/lib/catministrator/requests'
import { replyToTelegram, telegramBot, type TelegramUpdate } from '../src/lib/catministrator/telegram'
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
  const cmsOrigin = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  console.log(`Listening for private messages to @${bot.username}. AI interpretation is ${interpret ? 'enabled' : 'disabled'}.`)
  while (!controller.signal.aborted) {
    try {
      const updates = await call<TelegramUpdate[]>('getUpdates', {
        timeout: 25, limit: 1, offset, allowed_updates: ['message'],
      }, 35000)
      for (const update of updates) {
        if (!Number.isSafeInteger(update.update_id) || update.update_id < offset) continue
        const response = await replyToTelegram(update.message, {
          cmsOrigin, interpret,
          isLinked: async (id, date) => Boolean(await linkedTelegramEditor(payload, id, date)),
          save: async (id, date, request) => {
            const editor = await linkedTelegramEditor(payload, id, date)
            if (!editor) throw new DraftRequestError('This Telegram account can no longer edit the CMS.')
            const saved = await saveCatministratorDraft(payload, editor, request)
            console.log('Processed Catministrator update ' + update.update_id + ' as CMS user ' + editor.id + '.')
            return saved
          },
          onError: () => console.error('Catministrator draft request failed.'),
        })
        const nextOffset = update.update_id + 1
        const pendingFile = offsetFile + '.' + process.pid + '.tmp'
        await writeFile(pendingFile, String(nextOffset), { mode: 0o600 })
        await rename(pendingFile, offsetFile)
        offset = nextOffset
        if (response) await call('sendMessage', {
          chat_id: response.chat, text: response.text, link_preview_options: { is_disabled: true },
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
