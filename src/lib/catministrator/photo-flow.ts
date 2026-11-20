import { randomBytes } from 'node:crypto'
import { readIntakeDetails, type IntakeDetails } from './animal-intake'
import type { DraftReceipt } from './drafts'
import type { PhotoPlan } from './photo-drafts'
import type { PreparedImage, TelegramFile } from './photo-input'
import { AnimalNameError, DraftRequestError, isCancelRequest } from './requests'

export type PhotoWork = {
  files: TelegramFile[]
  startedAt: number
  expiresAt: number
  nonce: string
  details?: IntakeDetails
  plan?: PhotoPlan
}

type PhotoReply = { text: string; buttons?: { text: string; callback_data: string }[][] } | { draft: DraftReceipt }

type PhotoFlowOptions = {
  load: (id: number) => Promise<PhotoWork | undefined>
  store: (id: number, work?: PhotoWork) => Promise<void>
  isLinked: (id: number, date: number) => Promise<boolean>
  find: (id: number, date: number, name: string) => Promise<{ id: number; name: string }>
  download: (file: TelegramFile) => Promise<PreparedImage>
  read?: (images: PreparedImage[]) => Promise<IntakeDetails>
  save: (id: number, date: number, plan: PhotoPlan, images: PreparedImage[]) => Promise<DraftReceipt>
  onError: () => void
}

function photoPrompt(work: PhotoWork, prefix = ''): PhotoReply {
  const count = work.files.length
  const plan = work.plan
  const buttons: { text: string; callback_data: string }[][] = []
  const lines = prefix ? [prefix] : []
  if (count) lines.push(count === 1 ? 'I received 1 photo.' : `I received ${count} photos.`)
  if (plan) {
    const name = plan.kind === 'create' ? plan.fields.name : plan.name
    const action = plan.kind === 'create' ? `Create an animal draft for ${name}` : `Save to ${name}’s draft`
    lines.push(`${action}?`)
    if (count) lines.push('Use clean animal photos here. Choose Read details from image for flyers.')
    buttons.push([{ text: plan.kind === 'create' ? 'Create animal draft' : 'Save animal draft', callback_data: `/photo-action ${work.nonce} save` }])
  } else {
    lines.push(work.details
      ? 'Reply “Use details for Fig” to update an existing animal, or “New cat Willow” to create a draft.'
      : 'Reply with the animal’s name, or say “New cat Willow” to start a draft.')
  }
  if (count) buttons.push([{ text: 'Read details from image', callback_data: `/photo-action ${work.nonce} read` }])
  return { text: lines.join(' '), buttons }
}

function describeDetails(details: IntakeDetails) {
  const { name, species, sex, ageGroup, breed, summary, description } = details
  return [
    'I read these details from the image.',
    [name, species, sex, ageGroup, breed].filter(Boolean).join(' · '),
    summary, description === summary ? '' : description,
    'The image was used for reference. Send clean photos separately for the website.',
  ].filter(Boolean).join('\n')
}

export function createPhotoFlow(options: PhotoFlowOptions) {
  return async ({ id, date, text, photos }: { id: number; date: number; text: string; photos: TelegramFile[] }): Promise<PhotoReply | undefined> => {
    let work = await options.load(id)
    if (work && (work.expiresAt <= Date.now() || date < work.startedAt || !await options.isLinked(id, work.startedAt))) {
      await options.store(id)
      work = undefined
    }
    const message = text.trim().replace(/^(?:please\s+|(?:can|could|would) you (?:please )?)/i, '')
    const choice = /^\/photo-action ([\w-]+) (read|save)$/.exec(text.trim())
    const newAnimal = /^(?:\/new|new|(?:add|create)(?: a)?(?: new)?)\s+(cat|dog)\s+(?:(?:named|called)\s+)?(.+?)[.!?]?$/i.exec(message)
    const target = /^(?:\/photos|this is|(?:her |his )?name is|it['’]s|photos? (?:of|for)|(?:add|attach) (?:(?:these |this |the )?(?:photos?|pictures?|images?) )?to|use (?:the )?details for)\s+(.+?)(?:['’]s (?:profile|draft|gallery))?[.!?]?$/i.exec(message)?.[1]
    const read = /^(?:read|extract) (?:(?:the )?(?:text|details) (?:from|on) )?(?:the |this )?(?:image|photo|flyer|screenshot)[.!]?$/i.test(text.trim())
    if (isCancelRequest(text) && work) {
      await options.store(id)
      return { text: 'Photo and intake request canceled.' }
    }
    if (!photos.length && !work && !newAnimal) {
      if (choice || target && text.startsWith('/photos') || read) return { text: 'Send the photo or flyer first so I can help.' }
      return
    }
    if (choice && (!work || choice[1] !== work.nonce)) return { text: 'That photo choice is out of date. Use the latest reply.' }
    const bareName = !choice && !newAnimal && !read && (work || photos.length > 0) && !work?.plan && !target &&
      /^(?!feature\b|replace\b|edit\b|set\b|mark\b|change\b|update\b|delete\b|undo\b|can\b|please\b|what\b|how\b)[\p{L}\p{N}][\p{L}\p{N} .'’-]{0,69}$/iu.test(text.trim())
      ? text.trim() : ''
    if (!photos.length && !choice && !newAnimal && !target && !read && !bareName) return

    const original = work
    work ||= { files: [], startedAt: date, expiresAt: 0, nonce: '' }
    try {
      if (photos.length) {
        const files = [...new Map([...work.files, ...photos].map(file => [file.file_unique_id, file])).values()]
        if (files.length > 10) throw new DraftRequestError('I can keep up to 10 photos at a time. Save the current set or say “Cancel the photo request” to start over.')
        work = { ...work, files }
      }
      const remember = async (pending: PhotoWork) => {
        const next = { ...pending, expiresAt: Date.now() + 30 * 60 * 1000, nonce: randomBytes(6).toString('base64url') }
        await options.store(id, next)
        return next
      }
      if (photos.length) work = await remember(work)

      if (choice?.[2] === 'save') {
        if (!work.plan) throw new DraftRequestError('Tell me which animal to use first.')
        // Download everything before making any CMS changes.
        const images = []
        for (const file of work.files) images.push(await options.download(file))
        const draft = await options.save(id, date, work.plan, images)
        await options.store(id)
        return { draft }
      }
      if (read || choice?.[2] === 'read') {
        if (!work.files.length) throw new DraftRequestError('Send the flyer or screenshot you want me to read.')
        if (!options.read) throw new DraftRequestError('Image reading is unavailable. You can still attach photos and create drafts with a name and species.')
        if (work.files.length > 3) throw new DraftRequestError('Say “Cancel the photo request,” then send up to three flyer images to read together.')
        const images = []
        for (const file of work.files) images.push(await options.download(file))
        const details = await options.read(images)
        if (!Object.keys(details).length) return photoPrompt(work, 'I couldn’t find readable animal details in those images.')
        work = await remember({ ...work, files: [], details, plan: undefined })
        if (details.name) {
          try {
            const animal = await options.find(id, date, details.name)
            work = await remember({ ...work, plan: { kind: 'update', ...animal, fields: details } })
          } catch (error) {
            if (!(error instanceof AnimalNameError)) throw error
            if (!error.issue.suggestions.length && details.species) {
              work = await remember({ ...work, plan: { kind: 'create', fields: { ...details, name: details.name, species: details.species } } })
            }
          }
        }
        return photoPrompt(work, describeDetails(details))
      }
      if (newAnimal) {
        const details = readIntakeDetails({ ...work.details, name: newAnimal[2], species: newAnimal[1].toLowerCase() })
        if (!details.name || !details.species) throw new DraftRequestError('Send “New cat” or “New dog” followed by the animal’s name.')
        work = await remember({ ...work, plan: { kind: 'create', fields: { ...details, name: details.name, species: details.species } } })
      } else if (target || bareName) {
        if (!work.files.length && !work.details) return { text: 'Send the photos or flyer first.' }
        const reference = (target || bareName).trim().replace(/^(?:i meant|use)\s+/i, '')
        if (work.plan) work = await remember({ ...work, plan: undefined })
        const animal = await options.find(id, date, reference)
        work = await remember({ ...work, plan: { kind: 'update', ...animal, fields: work.details } })
      }
      return photoPrompt(work)
    } catch (error) {
      if (error instanceof AnimalNameError) {
        const suggestions = error.issue.suggestions.map(animal => animal.name).join(', ')
        return photoPrompt({ ...work, plan: undefined }, error.message + (suggestions ? ` Try ${suggestions}.` : ''))
      }
      if (error instanceof DraftRequestError) return { text: error.message }
      options.onError()
      return { text: original || photos.length
        ? 'I couldn’t finish that photo request. Try again, say “Cancel the photo request,” or open the CMS.'
        : 'I couldn’t set up that intake draft. Try again or use the CMS.' }
    }
  }
}
