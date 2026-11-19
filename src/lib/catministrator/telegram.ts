import { commandHelp, DraftRequestError, parseDraftCommand, type DraftRequest } from './requests'

type TelegramMessage = {
  chat?: { id: number; type: string }
  date?: number
  from?: { id: number; is_bot?: boolean }
  text?: string
}

export type TelegramUpdate = { update_id: number; message?: TelegramMessage }

export async function replyToTelegram(
  message: TelegramMessage | undefined,
  handlers: {
    isLinked: (id: number, date: number) => Promise<boolean>
    save: (id: number, date: number, request: DraftRequest) => Promise<{ message: string; path: string }>
    interpret?: (text: string) => Promise<DraftRequest>
    cmsOrigin: string
    onError: () => void
  },
): Promise<{ chat: number; text: string } | undefined> {
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
    const command = parseDraftCommand(text)
    if (!command && (text.startsWith('/') || !handlers.interpret)) return answer(commandHelp)
    const draft = command ?? await handlers.interpret!(text)
    const result = await handlers.save(id, date, draft)
    return answer(result.message + '\nReview in the CMS: ' + new URL(result.path, handlers.cmsOrigin).href)
  } catch (error) {
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
