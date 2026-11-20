import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload } from 'payload'
import type { User } from '../../payload-types'
import { fillEmptySlug } from '../slug'
import { readIntakeDetails, type IntakeDetails } from './animal-intake'
import { findAnimal, type DraftReceipt } from './drafts'
import { isEditor } from './editors'
import type { PreparedImage } from './photo-input'
import { DraftRequestError } from './requests'

export type PhotoPlan = { kind: 'update'; id: number; name: string; fields?: IntakeDetails }
  | { kind: 'create'; fields: IntakeDetails & { name: string; species: 'cat' | 'dog' } }

export async function findPhotoAnimal(payload: Payload, editor: User, reference: string) {
  if (!isEditor(editor)) throw new DraftRequestError('This CMS account cannot edit animals.')
  const req = await createLocalReq({ user: editor }, payload)
  const { id, name } = await findAnimal(req, reference, true)
  return { id, name }
}

export async function savePhotoDraft(payload: Payload, editor: User, plan: PhotoPlan, images: PreparedImage[]): Promise<DraftReceipt> {
  if (!isEditor(editor)) throw new DraftRequestError('This CMS account cannot edit animals.')
  const { name, species, ...details } = readIntakeDetails(plan.fields || {})
  const req = await createLocalReq({ user: editor }, payload)
  const options = { req, overrideAccess: false, depth: 0 } as const
  const started = await initTransaction(req)
  const createdMedia: number[] = []
  let saved = false
  try {
    const current = plan.kind === 'update'
      ? await payload.findByID({ ...options, collection: 'animals', id: plan.id, draft: true })
      : undefined
    if (plan.kind === 'create') {
      if (!name || !species) throw new DraftRequestError('I need an animal name and whether it’s a cat or dog.')
      const slug = fillEmptySlug(undefined, name)
      if (typeof slug !== 'string' || !slug) throw new DraftRequestError('Enter a name I can use for the animal’s profile.')
      const { docs } = await payload.find({
        ...options, collection: 'animals', draft: true, limit: 1,
        where: { or: [{ slug: { equals: slug } }, { name: { equals: name } }] },
      })
      if (docs.length) throw new DraftRequestError(`A profile already exists for ${name}. Tell me to use that animal’s draft instead.`)
    }
    const photos = [...current?.photos || []]
    let added = 0
    for (const image of images) {
      const basename = 'catministrator-' + image.digest
      const { docs: [existing] } = await payload.find({
        ...options, collection: 'media', limit: 1, where: { filename: { equals: basename + '.webp' } },
      })
      const media = existing || await payload.create({
        ...options, collection: 'media', data: { alt: current?.name || name || '' },
        file: { name: basename + '.jpg', data: image.data, size: image.data.byteLength, mimetype: 'image/jpeg' },
      })
      if (!existing) createdMedia.push(media.id)
      if (photos.some(row => (typeof row.photo === 'number' ? row.photo : row.photo.id) === media.id)) continue
      photos.push({ photo: media.id })
      added++
    }

    if (current && !added && !Object.keys(details).length) {
      const message = images.length ? 'These photos are already on the profile.' : 'Send a clean photo or more profile details to add.'
      if (started) await commitTransaction(req)
      saved = true
      return { message, path: '/admin/collections/animals/' + current.id, changed: false }
    }
    const values = { ...details, ...(photos.length ? { photos } : {}), _status: 'draft' as const }
    const animal = current
      ? await payload.update({ ...options, collection: 'animals', id: current.id, draft: true, overrideLock: false, data: values })
      : await payload.create({ ...options, collection: 'animals', draft: true, data: { ...values, name, species } })
    if (started) await commitTransaction(req)
    saved = true
    const photoCount = added === 1 ? 'Added 1 photo.' : added > 1 ? `Added ${added} photos.` : ''
    return {
      message: [`Draft saved for ${animal.name}.`, photoCount,
        !current && !photos.length ? 'Send a clean photo to add it to this draft.' : '',
        !current && !animal.ageGroup ? 'Add an age group before publishing.' : ''].filter(Boolean).join(' '),
      path: '/admin/collections/animals/' + animal.id,
      changed: true,
    }
  } finally {
    if (!saved) {
      if (started) await killTransaction(req)
      // Compensate for upload records created by this attempt if the profile write fails.
      for (const id of createdMedia) {
        await payload.delete({ collection: 'media', id, user: editor, overrideAccess: false }).catch(() => undefined)
      }
    }
  }
}
