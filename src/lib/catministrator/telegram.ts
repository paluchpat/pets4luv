import { randomBytes } from 'node:crypto'
import type { DraftReceipt } from './drafts'
import type { ModelInput, ModelDecision } from './model'
import type { PhotoReply, PhotoWork, createPhotoFlow } from './photo-flow'
import type { TelegramFile } from './photo-input'
import {
  AnimalNameError, correctAnimalReference, DeleteRequestError, DraftRequestError,
  validateDraftRequest, type AnimalNameIssue, type DraftRequest,
} from './requests'

type TelegramMessage = {
  chat?: { id: number; type: string }
  date?: number
  from?: { id: number; is_bot?: boolean }
  text?: string
  button?: string
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
    chat: callback.message.chat, from: callback.from, date: Math.floor(Date.now() / 1000), button: callback.data,
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
  const review = result.review
  if (!review) return { chat, text: result.message, replyMarkup: { inline_keyboard: [cms] } }

  const rows: NonNullable<TelegramReply['replyMarkup']>['inline_keyboard'] = [
    review.kind === 'animal'
      ? [linkButton('Preview animal page', '/preview/animal/' + review.previewToken, cmsOrigin)]
      : [linkButton('Preview homepage', '/preview/featured/' + review.previewToken, cmsOrigin)],
  ]
  if (canPublish && review.publishToken) rows.push([{ text: 'Publish this draft', callback_data: '/publish ' + review.publishToken }])
  rows.push(cms)
  const publishNote = review.kind === 'animal' && review.missing.length
    ? '\nBefore publishing, add ' + review.missing.join(', ') + '.'
    : ''
  const expiration = canPublish && review.publishToken ? 'The preview and approval expire in 30 minutes.' : 'The preview expires in 30 minutes.'
  return { chat, text: result.message + publishNote + '\n' + expiration, replyMarkup: { inline_keyboard: rows } }
}

function publicationReply(chat: number, result: DraftReceipt, cmsOrigin: string): TelegramReply {
  return {
    chat,
    text: result.message,
    replyMarkup: { inline_keyboard: [
      [linkButton(result.path.startsWith('/animals/') ? 'View animal profile' : 'View the homepage', result.path, cmsOrigin)],
      ...(result.undoToken ? [[{ text: 'Undo featured publish', callback_data: '/undo ' + result.undoToken }]] : []),
    ] },
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

export type ModelFollowUp = {
  request: string
  reply: string
  animalDraft?: string
  requestedAt: number
  expiresAt: number
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
    modelFollowUps?: {
      load: (id: number) => Promise<ModelFollowUp | undefined>
      store: (id: number, pending?: ModelFollowUp) => Promise<void>
    }
    publish?: (id: number, date: number, token: string) => Promise<DraftReceipt>
    reviewAnimal?: (id: number, date: number, animal: string) => Promise<DraftReceipt>
    undo?: (id: number, date: number, request: { token?: string; featured: boolean }) => Promise<DraftReceipt>
    interpret?: (input: ModelInput) => Promise<ModelDecision>
    cmsOrigin: string
    photoFlow?: ReturnType<typeof createPhotoFlow>
    onError: () => void
  },
): Promise<TelegramReply | undefined> {
  const { chat, date, from } = message || {}
  if (!message || chat?.type !== 'private' || !from || from.is_bot || chat.id !== from.id || !Number.isSafeInteger(from.id) || from.id < 1 ||
      typeof date !== 'number' || !Number.isSafeInteger(date)) return undefined
  const id = from.id
  const answer = (text: string) => ({ chat: id, text })
  const { button } = message
  const photos = messagePhotos(message)
  const photoFlow = handlers.photoFlow
  let text = message.text || message.caption || ''
  let pending: NameFollowUp | undefined
  let attempt: DraftRequest | undefined
  let requestedAt = date
  let work: PhotoWork | undefined
  const showReview = async (result: DraftReceipt) => {
    if (result.review?.kind === 'animal') {
      await handlers.modelFollowUps?.store(id, {
        request: text, reply: result.message, animalDraft: result.review.animal,
        requestedAt: date, expiresAt: Date.now() + 30 * 60 * 1000,
      }).catch(handlers.onError)
    }
    return reviewReply(id, result, handlers.cmsOrigin, Boolean(handlers.publish))
  }
  const photoReply = (reply: PhotoReply) => 'draft' in reply ? showReview(reply.draft) :
    { ...answer(reply.text), ...(reply.buttons?.length && { replyMarkup: { inline_keyboard: reply.buttons } }) }

  async function resumeWithName(reference: string, receivedAt: number) {
    if (!pending || receivedAt < pending.requestedAt || !await handlers.isLinked(id, pending.requestedAt)) {
      return answer('Tell me the original request again with the animal’s correct name.')
    }
    const version = pending.issue.featuredVersion
    requestedAt = pending.requestedAt
    attempt = correctAnimalReference(pending.draft, pending.issue.field, reference)
    await handlers.nameFollowUps?.store(id)
    const result = await handlers.save(id, receivedAt, attempt, version)
    return await showReview(result)
  }

  try {
    // Check the CMS role and Telegram link before reading state, downloading files, or using AI.
    if (!await handlers.isLinked(id, date)) {
      return answer(`Your Telegram user ID is ${id}. Give it to a Pets4Luv administrator to link your editor account.`)
    }
    if (text.length > 3500) return answer('Please send a shorter request.')
    pending = await handlers.nameFollowUps?.load(id)
    if (pending && (!Number.isSafeInteger(pending.requestedAt) || !Number.isFinite(pending.expiresAt)
        || pending.expiresAt <= Date.now() || date < pending.requestedAt || !await handlers.isLinked(id, pending.requestedAt))) {
      await handlers.nameFollowUps?.store(id)
      pending = undefined
    }

    // Only genuine Telegram button callbacks can supply approval or selection tokens.
    const publish = button && /^\/publish (\S+)$/.exec(button)
    if (publish && handlers.publish) {
      const result = await handlers.publish(id, date, publish[1])
      await handlers.nameFollowUps?.store(id)
      await handlers.modelFollowUps?.store(id)
      return result.review ? reviewReply(id, result, handlers.cmsOrigin, true) : publicationReply(id, result, handlers.cmsOrigin)
    }
    const undo = button && /^\/undo (\S+)$/.exec(button)
    if (undo && handlers.undo) {
      return publicationReply(id, await handlers.undo(id, date, { token: undo[1], featured: true }), handlers.cmsOrigin)
    }
    const choice = button && /^\/name (\S+) ([0-2])$/.exec(button)
    if (choice) {
      const match = pending?.nonce === choice[1] && pending.issue.suggestions[Number(choice[2])]
      return match ? await resumeWithName('slug:' + match.slug, date) : answer('That choice is out of date. Use the most recent suggestion.')
    }
    work = await photoFlow?.load(id, date)
    const photoChoice = button && /^\/photo-action ([\w-]+) (read|save)$/.exec(button)
    if (photoChoice && photoFlow) {
      if (!work || work.nonce !== photoChoice[1]) return answer('That choice is out of date. Use the most recent reply.')
      if (photoChoice[2] === 'save') return await photoReply(await photoFlow.confirm(id, date, work, photoChoice[1]))
      text = 'Read the intake sheet or flyer in these images without updating the CMS.'
    } else if (button) {
      return answer('That choice is unavailable. Tell me what you’d like to update.')
    }
    if (!handlers.interpret) {
      return {
        ...answer('AI assistance is currently unavailable. You can make your update in the CMS.'),
        replyMarkup: { inline_keyboard: [[linkButton('Open the CMS', '/admin', handlers.cmsOrigin)]] },
      }
    }
    if (photoFlow && photos.length) work = await photoFlow.collect(id, date, work, photos)
    const images = await photoFlow?.download(work) || []
    const recent = await handlers.modelFollowUps?.load(id)
    const validRecent = recent && Number.isFinite(recent.expiresAt) && recent.expiresAt > Date.now()
      && date >= recent.requestedAt && await handlers.isLinked(id, recent.requestedAt)
    const decision = await handlers.interpret({
      text, images,
      context: {
        canSaveIntake: photoFlow?.canSave || false,
        newAttachments: work?.files.flatMap((file, index) => photos.some(photo => photo.file_unique_id === file.file_unique_id)
          ? [index + 1] : []),
        unsupportedAttachment: Boolean(message.document && !photos.length || !text && !photos.length && !button),
        photoIntake: work && { intent: work.intent, animal: work.animal, details: work.details,
          attachmentTypes: work.attachments, proposedDraft: work.plan && { kind: work.plan.kind,
            name: work.plan.kind === 'create' ? work.plan.fields.name : work.plan.name } },
        nameCorrection: pending && { originalRequest: pending.draft, reference: pending.issue.reference,
          suggestions: pending.issue.suggestions },
        ...(validRecent && { previousMessage: recent.request, previousReply: recent.reply, recentAnimalDraft: recent.animalDraft }),
      },
    })
    if (decision.action === 'reply') {
      await handlers.modelFollowUps?.store(id, {
        request: text, reply: decision.message, requestedAt: date, expiresAt: Date.now() + 30 * 60 * 1000,
        animalDraft: validRecent ? recent.animalDraft : undefined,
      })
      return answer(decision.message)
    }
    await handlers.modelFollowUps?.store(id)
    if (decision.action === 'review-animal') {
      const animal = decision.animal || (validRecent && recent.animalDraft)
      if (!animal) return answer('Which animal’s draft would you like to preview?')
      if (!handlers.reviewAnimal) return answer('Open the animal’s draft in the CMS to review it.')
      return await showReview(await handlers.reviewAnimal(id, date, animal))
    }
    if (decision.action === 'correct-name') return await resumeWithName(decision.animal, date)
    if (decision.action === 'cancel') {
      await handlers.nameFollowUps?.store(id)
      await photoFlow?.clear(id)
      return answer(pending || work ? 'I cleared the pending request.' : 'There’s no pending request to cancel.')
    }
    if (decision.action === 'undo' || decision.action === 'undo-featured') {
      if (!text.trim() || photos.length || !handlers.undo) return answer('Tell me in a text message which change you want to undo.')
      const result = await handlers.undo(id, date, { featured: decision.action === 'undo-featured' })
      await handlers.nameFollowUps?.store(id)
      return publicationReply(id, result, handlers.cmsOrigin)
    }
    if (decision.action === 'confirm-intake') {
      if (!photoFlow || !text.trim() || photos.length) return answer('Open the latest intake proposal to review and save the draft.')
      return await photoReply(await photoFlow.confirm(id, date, work, undefined, images))
    }
    if (decision.action === 'create-animal' || decision.action === 'update-animal-media' || decision.action === 'read-images') {
      if (!photoFlow) return answer('Animal intake is unavailable on this connection. Open the CMS to add the animal.')
      return await photoReply(await photoFlow.propose(id, date, work, decision))
    }

    attempt = validateDraftRequest(decision)
    await handlers.nameFollowUps?.store(id)
    const result = await handlers.save(id, date, attempt)
    return await showReview(result)
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
    if (!(error instanceof DraftRequestError)) handlers.onError()
    return answer(error instanceof DraftRequestError ? error.message
      : 'I couldn’t finish that request. Try again or use the CMS.')
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
