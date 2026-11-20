import { randomBytes } from 'node:crypto'
import type { DraftReceipt } from './drafts'
import type { createPhotoFlow } from './photo-flow'
import type { TelegramFile } from './photo-input'
import {
  AnimalNameError, commandHelp, correctAnimalReference, DeleteRequestError, DraftRequestError,
  parseDraftCommand, type AnimalNameIssue, type DraftRequest,
} from './requests'

type TelegramMessage = {
  chat?: { id: number; type: string }
  date?: number
  from?: { id: number; is_bot?: boolean }
  text?: string
  caption?: string
  photo?: TelegramFile[]
  document?: TelegramFile
  media_group_id?: string
  album?: TelegramFile[]
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
  if (!/^(?:\/publish|\/undo|\/name|\/photo-action) /.test(callback?.data || '') || !callback?.message?.chat) return
  return {
    chat: callback.message.chat, from: callback.from, date: Math.floor(Date.now() / 1000), text: callback.data,
  }
}

function messagePhotos(message: TelegramMessage): TelegramFile[] {
  if (message.album) return message.album
  const photo = message.photo?.at(-1)
  if (photo) return [photo]
  if (message.document?.mime_type?.startsWith('image/')) return [message.document]
  return []
}

export function combinePhotoUpdates(updates: TelegramUpdate[]) {
  const combined: TelegramUpdate[] = []
  for (const update of updates) {
    const message = update.message
    const last = combined.at(-1)
    const previous = last?.message
    if (message?.media_group_id && previous?.media_group_id === message.media_group_id &&
        previous.chat?.id === message.chat?.id && previous.from?.id === message.from?.id) {
      combined[combined.length - 1] = { ...update, message: {
        ...previous, caption: previous.caption || message.caption, album: [...messagePhotos(previous), ...messagePhotos(message)],
      } }
    } else combined.push(update)
  }
  return combined
}

function linkButton(text: string, path: string, cmsOrigin: string) {
  const url = new URL(path, cmsOrigin)
  // Telegram's HTTP URL validator expects a dotted hostname or an IPv6 address.
  if (url.protocol === 'http:' && url.hostname === 'localhost') url.hostname = '127.0.0.1'
  return { text, url: url.href }
}

function reviewReply(chat: number, result: DraftReceipt, cmsOrigin: string, canPublish: boolean): TelegramReply {
  const cms = [linkButton('Review in the CMS', result.path, cmsOrigin)]
  if (!result.review || !canPublish) {
    return { chat, text: result.message, replyMarkup: { inline_keyboard: [cms] } }
  }
  const { previewToken, publishToken } = result.review
  return {
    chat,
    text: result.message + '\nThe preview and approval expire in 30 minutes.',
    replyMarkup: { inline_keyboard: [
      [linkButton('Preview homepage', '/preview/featured/' + previewToken, cmsOrigin)],
      [{ text: 'Publish this draft', callback_data: '/publish ' + publishToken }],
      cms,
    ] },
  }
}

function homepageReply(chat: number, result: DraftReceipt, cmsOrigin: string): TelegramReply {
  return {
    chat,
    text: result.message,
    replyMarkup: { inline_keyboard: [
      [linkButton('View the homepage', result.path, cmsOrigin)],
      ...(result.undoToken ? [[{ text: 'Undo featured publish', callback_data: '/undo ' + result.undoToken }]] : []),
    ] },
  }
}

function undoRequest(text: string): { token?: string; featured: boolean } | undefined {
  const phrase = text.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '')
    .replace(/^(?:(?:can|could|would) you )?(?:please )?/i, '')
  const command = /^\/undo(?:\s+(\S+))?$/i.exec(phrase)
  if (command) return { token: command[1], featured: true }
  if (/^undo(?: (?:the |my )?last (?:action|change))?$/i.test(phrase)) return { featured: false }
  if (/^restore (?:the )?previous featured(?: animals)? order$/i.test(phrase)) return { featured: true }
  if (/^(?:undo|revert) (?:(?:the |my )?(?:last |latest )?featured(?: animals)? (?:publish|publication)|publishing (?:the )?(?:new )?featured animals(?: order)?)$/i.test(phrase)) {
    return { featured: true }
  }
}

export type NameFollowUp = {
  draft: DraftRequest
  issue: AnimalNameIssue
  message: string
  requestedAt: number
  expiresAt: number
  nonce: string
}

function nameFollowUpReply(chat: number, pending: NameFollowUp): TelegramReply {
  const { suggestions } = pending.issue
  const canChoose = suggestions.length > 0
  const question = suggestions.length === 1
    ? ` Did you mean ${suggestions[0].name}?`
    : canChoose ? ' Which animal did you mean?' : ''
  const buttons = suggestions.map(({ name, slug }, index) => {
    const duplicate = suggestions.some(other => other.slug !== slug && other.name.toLowerCase() === name.toLowerCase())
    return [{ text: duplicate ? `${name} (${slug})` : name, callback_data: `/name ${pending.nonce} ${index}` }]
  })
  return {
    chat,
    text: pending.message + question + '\n' +
      (canChoose ? 'Tap a match or reply “I meant” followed by the correct name.' : 'Reply “I meant” followed by the correct name or CMS slug.'),
    ...(canChoose && { replyMarkup: { inline_keyboard: buttons } }),
  }
}

function typedCorrection(text: string) {
  return /^(?:i meant|i mean|actually,? (?:i meant|use))\s+(.+?)[.!?]?$/i.exec(text.trim())?.[1]
    .trim().replace(/^[“"]|[”"]$/g, '')
}

export async function replyToTelegram(
  message: TelegramMessage | undefined,
  handlers: {
    isLinked: (id: number, date: number) => Promise<boolean>
    save: (id: number, date: number, request: DraftRequest, featuredVersion?: string | null) => Promise<DraftReceipt>
    nameFollowUps?: {
      load: (id: number) => Promise<NameFollowUp | undefined>
      store: (id: number, pending?: NameFollowUp) => Promise<void>
    }
    publish?: (id: number, date: number, token: string) => Promise<DraftReceipt>
    undo?: (id: number, date: number, request: { token?: string; featured: boolean }) => Promise<DraftReceipt>
    interpret?: (text: string) => Promise<DraftRequest>
    cmsOrigin: string
    photoFlow?: ReturnType<typeof createPhotoFlow>
    onError: () => void
  },
): Promise<TelegramReply | undefined> {
  const { chat, date, from } = message || {}
  if (!message || chat?.type !== 'private' || !from || from.is_bot || chat.id !== from.id || !Number.isSafeInteger(from.id) || from.id < 1 ||
      typeof date !== 'number' || !Number.isSafeInteger(date)) return undefined
  const text = message.text || message.caption || ''
  const photos = messagePhotos(message)
  const id = from.id
  const answer = (reply: string) => ({ chat: id, text: reply })
  const undo = undoRequest(text)
  let pending: NameFollowUp | undefined
  let attempt: DraftRequest | undefined
  let requestedAt = date
  const clearFollowUp = async () => {
    if (pending) await handlers.nameFollowUps?.store(id)
    pending = undefined
  }
  try {
    const linked = await handlers.isLinked(id, date)
    if (!linked) {
      return answer(text.trim() === '/start'
        ? `Your Telegram user ID is ${id}. Give it to a Pets4Luv administrator to link your editor account.`
        : 'This Telegram account needs to be linked by a Pets4Luv administrator. Send /start to see your user ID.')
    }
    if (text.length > 3500) return answer('Please send a shorter draft request.')
    const mediaReply = await handlers.photoFlow?.({ id, date, text, photos })
    if (mediaReply) {
      if ('draft' in mediaReply) return reviewReply(id, mediaReply.draft, handlers.cmsOrigin, false)
      return { ...answer(mediaReply.text), ...(mediaReply.buttons?.length && {
        replyMarkup: { inline_keyboard: mediaReply.buttons },
      }) }
    }
    if (photos.length) {
      return {
        ...answer('Photo handling is unavailable for this CMS connection. You can add photos in the CMS.'),
        replyMarkup: { inline_keyboard: [[linkButton('Open the animals CMS', '/admin/collections/animals', handlers.cmsOrigin)]] },
      }
    }
    if (!message.text || message.document) return answer('Send a photo, a JPG, PNG, or WebP file, or a text request. Send /help for examples.')
    pending = await handlers.nameFollowUps?.load(id)
    if (pending && (!Number.isSafeInteger(pending.requestedAt) || !Number.isFinite(pending.expiresAt) || pending.expiresAt <= Date.now())) await clearFollowUp()
    if (text.trim() === '/cancel') {
      const reply = pending ? 'Name clarification canceled. Send a new draft request when you’re ready.' : 'There’s no pending name clarification.'
      await clearFollowUp()
      return answer(reply)
    }
    if (['/start', '/help'].includes(text.trim())) {
      return answer('Catministrator saves drafts for review in the CMS.\n\n' + commandHelp +
        (handlers.undo ? '\n\n/undo — undo your latest featured publish.' : '') +
        (handlers.photoFlow ? '\n\nSend photos and name the animal, or choose Read details from image for a flyer. /new cat Willow starts an animal draft.' : '') +
        (handlers.interpret ? '\n\nYou can also describe a single change in plain language.' : ''))
    }
    if (/^(?:please\s+)?(?:\/delete|(?:permanently\s+)?delete)(?:\s|$)/i.test(text.trim())) throw new DeleteRequestError()
    if (undo && handlers.undo) {
      const result = await handlers.undo(id, date, undo)
      await clearFollowUp()
      return homepageReply(id, result, handlers.cmsOrigin)
    }
    const publication = /^\/publish(?:\s+(\S+))?$/i.exec(text.trim())
    if (publication) {
      if (!handlers.publish || !publication[1]) return answer('Use Publish this draft in a recent featured draft reply.')
      const result = await handlers.publish(id, date, publication[1])
      if (result.review) return reviewReply(id, result, handlers.cmsOrigin, true)
      await clearFollowUp()
      return homepageReply(id, result, handlers.cmsOrigin)
    }
    const choice = /^\/name (\S+) ([0-2])$/.exec(text.trim())
    const typed = typedCorrection(text)
    if ((choice || typed) && !pending) return answer('Send the draft request again so I know which animal to correct.')
    if (choice && choice[1] !== pending?.nonce) return answer('That choice is out of date. Use the most recent name suggestion.')
    const key = (typed || text).trim().toLowerCase()
    const suggestions = pending?.issue.suggestions || []
    const matching = suggestions.filter(({ name, slug }) => slug === key || name.toLowerCase() === key)
    const confirmed = /^(?:yes|correct|that’s right|that's right)[.!]?$/.test(key)
    let selected = matching.length === 1 ? matching[0] : undefined
    if (choice) selected = suggestions[Number(choice[2])]
    else if (confirmed && suggestions.length === 1) selected = suggestions[0]
    const corrected = selected ? 'slug:' + selected.slug : typed
    let featuredVersion: string | null | undefined
    if (pending && corrected) {
      if (date < pending.requestedAt || !await handlers.isLinked(id, pending.requestedAt)) {
        await clearFollowUp()
        return answer('This name clarification has expired. Send a new draft request.')
      }
      const current = pending
      requestedAt = current.requestedAt
      featuredVersion = current.issue.featuredVersion
      attempt = correctAnimalReference(current.draft, current.issue.field, corrected)
      await clearFollowUp()
    } else {
      if (pending && (choice || matching.length > 1 || confirmed || /^no[.!]?$/.test(key))) {
        return nameFollowUpReply(id, pending)
      }
      const command = parseDraftCommand(text)
      if (!command && (text.startsWith('/') || !handlers.interpret)) {
        return pending ? nameFollowUpReply(id, pending) : answer(commandHelp)
      }
      attempt = command ?? await handlers.interpret!(text)
      await clearFollowUp()
    }
    const result = await handlers.save(id, date, attempt, featuredVersion)
    return reviewReply(id, result, handlers.cmsOrigin, Boolean(handlers.publish))
  } catch (error) {
    if (error instanceof DeleteRequestError) {
      return {
        ...answer('Deleting is currently unavailable in Catministrator. Please log in to the CMS to manage this content.'),
        replyMarkup: { inline_keyboard: [[linkButton('Log in to the CMS', '/admin/login', handlers.cmsOrigin)]] },
      }
    }
    if (error instanceof AnimalNameError && attempt && handlers.nameFollowUps) {
      const next = {
        draft: attempt, issue: error.issue, message: error.message, requestedAt,
        expiresAt: Date.now() + 30 * 60 * 1000, nonce: randomBytes(6).toString('base64url'),
      }
      try {
        await handlers.nameFollowUps.store(id, next)
        return nameFollowUpReply(id, next)
      } catch {
        handlers.onError()
        return answer(error.message + ' Send the full request again with the correct name or CMS slug.')
      }
    }
    if (pending && !attempt && !undo && !text.startsWith('/') && error instanceof DraftRequestError) {
      return nameFollowUpReply(id, pending)
    }
    if (!(error instanceof DraftRequestError)) handlers.onError()
    const reply = error instanceof DraftRequestError ? error.message : undo
      ? 'I couldn’t undo that publication. Try again, or review it in the CMS.'
      : 'I couldn’t save that draft. Try again, or use the CMS.'
    return undo ? {
      ...answer(reply),
      replyMarkup: { inline_keyboard: [[linkButton('Review in the CMS', '/admin/globals/homepage', handlers.cmsOrigin)]] },
    } : answer(reply)
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
