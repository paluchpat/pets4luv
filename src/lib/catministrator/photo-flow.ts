import { randomBytes } from 'node:crypto'
import { animalColorOptions } from '../animal-colors'
import { compatibilityFields, type IntakeDetails } from './animal-intake'
import type { DraftReceipt } from './drafts'
import type { AttachmentKind, IntakeDecision } from './model'
import type { PhotoPlan } from './photo-drafts'
import type { PreparedImage, TelegramFile } from './photo-input'
import { AnimalNameError, DraftRequestError } from './requests'

export type PhotoWork = {
  files: TelegramFile[]
  startedAt: number
  expiresAt: number
  nonce: string
  intent?: IntakeDecision['action']
  animal?: string
  details?: IntakeDetails
  attachments?: AttachmentKind[]
  plan?: PhotoPlan
}

export type PhotoReply = { text: string; buttons?: { text: string; callback_data: string }[][] } | { draft: DraftReceipt }

type PhotoFlowOptions = {
  load: (id: number) => Promise<PhotoWork | undefined>
  store: (id: number, work?: PhotoWork) => Promise<void>
  isLinked: (id: number, date: number) => Promise<boolean>
  find?: (id: number, date: number, name: string) => Promise<{ id: number; name: string }>
  download: (file: TelegramFile) => Promise<PreparedImage>
  save?: (id: number, date: number, plan: PhotoPlan, images: PreparedImage[]) => Promise<DraftReceipt>
}

function pictureList(kinds: AttachmentKind[], kind: AttachmentKind) {
  return kinds.flatMap((value, i) => value === kind ? [i + 1] : []).join(', ')
}

function reviewDetails(details: IntakeDetails) {
  const colors = details.colors?.map(color => animalColorOptions.find(option => option.value === color)?.label || color) || []
  const compatibility = compatibilityFields.flatMap(group => {
    const assessment = details.compatibility?.[group]
    return assessment ? [group + ' ' + assessment] : []
  })
  const measurements = [
    details.size,
    details.weight && `${details.weight} lb`,
    details.status === 'on-hold' ? 'pending' : details.status,
  ].filter(Boolean).join(' · ')
  return [
    [details.name, details.species, details.sex, details.ageGroup, details.breed].filter(Boolean).join(' · '),
    colors.length ? 'Coat: ' + colors.join(', ') : '',
    details.estimatedBirthDate && 'Estimated birth date: ' + details.estimatedBirthDate,
    measurements,
    details.summary,
    details.description !== details.summary ? details.description : undefined,
    compatibility.length ? 'Compatibility: ' + compatibility.join(', ') : '',
    details.compatibilityNotes,
    details.careNeeds && 'Care for adopter: ' + details.careNeeds,
    details.rescueIntakeID && 'Staff only · Intake ID: ' + details.rescueIntakeID,
    details.internalNotes && 'Staff only · ' + details.internalNotes,
  ].filter((line): line is string => Boolean(line))
}

function intakeReply(lines: string[]) {
  const text = lines.join('\n')
  return text.length <= 3900 ? text : text.slice(0, 3800) + '\n… Review the complete details in the CMS after saving.'
}

export function createPhotoFlow(options: PhotoFlowOptions) {
  async function load(id: number, date: number) {
    const work = await options.load(id)
    if (work && (work.expiresAt <= Date.now() || date < work.startedAt || !await options.isLinked(id, work.startedAt))) {
      await options.store(id)
      return
    }
    return work
  }

  async function remember(id: number, work: PhotoWork) {
    const next = { ...work, expiresAt: Date.now() + 30 * 60 * 1000, nonce: randomBytes(6).toString('base64url') }
    await options.store(id, next)
    return next
  }

  async function collect(id: number, date: number, work: PhotoWork | undefined, photos: TelegramFile[]) {
    if (!photos.length) return work
    const newFiles = [...new Map(photos.map(file => [file.file_unique_id, file])).values()]
    const files = [...new Map([...(work?.files || []), ...newFiles].map(file => [file.file_unique_id, file])).values()]
    if (newFiles.length > 10) throw new DraftRequestError('Send up to 10 images in an album.')
    if (files.length > 10) return remember(id, { files: newFiles, startedAt: date, expiresAt: 0, nonce: '' })
    const attachments = files.map((_, index) => work?.attachments?.[index] || 'unknown')
    return remember(id, { ...work, files, attachments, startedAt: work?.startedAt ?? date, expiresAt: 0, nonce: '', plan: undefined })
  }

  async function download(work?: PhotoWork) {
    return Promise.all((work?.files || []).map(options.download))
  }

  async function propose(id: number, date: number, work: PhotoWork | undefined, decision: IntakeDecision): Promise<PhotoReply> {
    const files = work?.files || []
    const attachments = files.map((_, index) => work?.attachments?.[index] === 'reference'
      ? 'reference' : decision.attachments[index] || 'unknown')
    const pending = {
      files, attachments, startedAt: work?.startedAt ?? date, expiresAt: 0, nonce: '',
      intent: decision.action, details: decision.details, animal: decision.animal,
    }
    const { name, species, ...details } = decision.details
    const facts = reviewDetails(decision.details)
    const website = pictureList(attachments, 'photo')
    const reference = pictureList(attachments, 'reference')
    const unknown = pictureList(attachments, 'unknown')
    const pictureNotes = [
      website && 'Website photos: ' + website + '.',
      reference && 'Reference images kept out of the gallery: ' + reference + '.',
      unknown && 'Unclear images kept out of the gallery: ' + unknown + '.',
    ].filter(Boolean)
    let plan: PhotoPlan | undefined
    let nextQuestion = ''
    if (decision.action === 'read-images') {
      if (!files.length) return { text: 'Send the intake sheet or flyer you’d like me to read.' }
      nextQuestion = 'Would you like these details in a new profile or an existing animal’s draft?'
      if (!facts.length) nextQuestion = 'I couldn’t verify profile details from the images. You can send a clearer sheet or tell me the details.'
    } else if (!options.save) {
      return { text: 'I can review these details, but this CMS connection currently cannot create an intake or upload photos.' }
    } else if (decision.action === 'create-animal') {
      if (name && species) plan = { kind: 'create', fields: { name, species, ...details } }
      else nextQuestion = name ? `Is ${name} a cat or a dog?`
        : species ? `What’s the ${species}’s name?` : 'What’s the animal’s name, and is it a cat or a dog?'
    } else if (!decision.animal) {
      nextQuestion = 'Which animal should I use for this update?'
    } else if (!website && !Object.keys(details).length) {
      nextQuestion = 'Send a clean animal photo or tell me the profile details you’d like to add.'
    } else if (!options.find) {
      nextQuestion = 'I couldn’t look up that animal. Open the CMS to review the profile.'
    } else {
      try {
        const animal = await options.find(id, date, decision.animal)
        plan = { kind: 'update', ...animal, fields: details }
      } catch (error) {
        if (!(error instanceof AnimalNameError)) throw error
        const choices = error.issue.suggestions.map(animal => animal.name).join(', ')
        nextQuestion = error.message + (choices ? ` Did you mean ${choices}?` : ' Which animal should I use?')
      }
    }

    const next = await remember(id, { ...pending, plan })
    if (!plan) return {
      text: intakeReply([nextQuestion, ...pictureNotes, ...facts]),
    }
    const heading = plan.kind === 'create' ? `Create an animal draft for ${plan.fields.name}?` : `Save to ${plan.name}’s draft?`
    return {
      text: intakeReply([heading, ...pictureNotes, ...facts]),
      buttons: [[{ text: plan.kind === 'create' ? 'Create animal draft' : 'Save animal draft', callback_data: `/photo-action ${next.nonce} save` }]],
    }
  }

  async function confirm(id: number, date: number, work?: PhotoWork, nonce?: string, prepared?: PreparedImage[]): Promise<PhotoReply> {
    if (!options.save || !work?.plan || !work.attachments || work.attachments.length !== work.files.length || (nonce && work.nonce !== nonce)) {
      return { text: 'I don’t have a current animal draft proposal to save. Tell me what you’d like to add.' }
    }
    const photos = await Promise.all(work.files.flatMap((file, index) => work.attachments?.[index] === 'photo'
      ? [prepared?.[index] || options.download(file)] : []))
    const draft = await options.save(id, date, work.plan, photos)
    await options.store(id)
    return { draft }
  }

  return { load, collect, download, propose, confirm, clear: (id: number) => options.store(id), canSave: Boolean(options.save) }
}
