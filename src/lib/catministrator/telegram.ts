import type { DraftReceipt } from './drafts'
import { commandHelp, DeleteRequestError, DraftRequestError, parseDraftCommand, type DraftRequest } from './requests'

type TelegramMessage = {
  chat?: { id: number; type: string }
  date?: number
  from?: { id: number; is_bot?: boolean }
  text?: string
}

export type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  callback_query?: {
    id: string
    from: TelegramMessage['from']
    message?: TelegramMessage
    data?: string
  }
}

type TelegramReply = {
  chat: number
  text: string
  replyMarkup?: { inline_keyboard: { text: string; url?: string; callback_data?: string }[][] }
}

export function messageFromUpdate(update: TelegramUpdate): TelegramMessage | undefined {
  if (update.message) return update.message
  const callback = update.callback_query
  if (!callback?.data?.startsWith('/publish ') || !callback.message?.chat) return
  return {
    chat: callback.message.chat, from: callback.from, date: Math.floor(Date.now() / 1000), text: callback.data,
  }
}

function reviewReply(chat: number, result: DraftReceipt, cmsOrigin: string, canPublish: boolean): TelegramReply {
  const text = result.message + '\nReview in the CMS: ' + new URL(result.path, cmsOrigin).href
  if (!result.review || !canPublish) return { chat, text }
  const { previewToken, publishToken } = result.review
  const url = new URL('/preview/featured/' + previewToken, cmsOrigin)
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  return {
    chat,
    text: text + (local ? '\nPreview homepage: ' + url.href : '') + '\nThe preview and approval expire in 30 minutes.',
    replyMarkup: { inline_keyboard: [
      ...(local ? [] : [[{ text: 'Preview homepage', url: url.href }]]),
      [{ text: 'Publish this draft', callback_data: '/publish ' + publishToken }],
    ] },
  }
}

export async function replyToTelegram(
  message: TelegramMessage | undefined,
  handlers: {
    isLinked: (id: number, date: number) => Promise<boolean>
    save: (id: number, date: number, request: DraftRequest) => Promise<DraftReceipt>
    publish?: (id: number, date: number, token: string) => Promise<DraftReceipt>
    interpret?: (text: string) => Promise<DraftRequest>
    cmsOrigin: string
    onError: () => void
  },
): Promise<TelegramReply | undefined> {
  const { chat, date, from, text } = message || {}
  if (chat?.type !== 'private' || !from || from.is_bot || chat.id !== from.id || !Number.isSafeInteger(from.id) || from.id < 1 ||
      typeof date !== 'number' || !Number.isSafeInteger(date) || typeof text !== 'string') return undefined
  const id = from.id
  const answer = (reply: string) => ({ chat: id, text: reply })
  try {
    const linked = await handlers.isLinked(id, date)
    if (!linked) {
      return answer(text.trim() === '/start'
        ? `Your Telegram user ID is ${id}. Give it to a Pets4Luv administrator to link your editor account.`
        : 'This Telegram account needs to be linked by a Pets4Luv administrator. Send /start to see your user ID.')
    }
    if (['/start', '/help'].includes(text.trim())) {
      return answer('Catministrator saves drafts for review in the CMS.\n\n' + commandHelp +
        (handlers.interpret ? '\n\nYou can also describe a single change in plain language.' : ''))
    }
    if (text.length > 3500) return answer('Please send a shorter draft request.')
    if (/^(?:please\s+)?(?:\/delete|(?:permanently\s+)?delete)(?:\s|$)/i.test(text.trim())) throw new DeleteRequestError()
    const publication = /^\/publish(?:\s+(\S+))?$/i.exec(text.trim())
    if (publication) {
      if (!handlers.publish || !publication[1]) return answer('Use Publish this draft in a recent featured draft reply.')
      const result = await handlers.publish(id, date, publication[1])
      if (result.review) return reviewReply(id, result, handlers.cmsOrigin, true)
      return answer(result.message + '\nView the homepage: ' + new URL(result.path, handlers.cmsOrigin).href)
    }
    const command = parseDraftCommand(text)
    if (!command && (text.startsWith('/') || !handlers.interpret)) return answer(commandHelp)
    const draft = command ?? await handlers.interpret!(text)
    const result = await handlers.save(id, date, draft)
    return reviewReply(id, result, handlers.cmsOrigin, Boolean(handlers.publish))
  } catch (error) {
    if (error instanceof DeleteRequestError) {
      return answer('Deleting is currently unavailable in Catministrator. Please log in to the CMS to manage this content.\n' +
        new URL('/admin/login', handlers.cmsOrigin).href)
    }
    if (error instanceof DraftRequestError) return answer(error.message)
    handlers.onError()
    return answer('I couldn’t save that draft. Try again, or use the CMS.')
  }
}

export function telegramBot(token: string, signal: AbortSignal) {
  return async function call<T>(method: string, data: object = {}, timeoutMs = 15000): Promise<T> {
    const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
    })
    const json = await response.json() as { ok: boolean; result: T; error_code?: number }
    if (!response.ok || !json.ok) {
      throw new Error(`Telegram ${method} failed (HTTP ${json.error_code || response.status}).`)
    }
    return json.result
  }
}
