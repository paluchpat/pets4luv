import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'
import type { User } from '../../payload-types'
import { featuredAnimalEligibility, featuredAnimalIds } from '../featured-animals'
import { animalDraftRequest, DraftRequestError, featuredDraftRequest, type DraftRequest } from './requests'

export function isEditor(user: User | undefined | null): user is User {
  return user?.role === 'admin' || user?.role === 'editor'
}

async function findAnimal(req: PayloadRequest, reference: string, draft: boolean) {
  const key = reference.toLowerCase()
  const { docs } = await req.payload.find({
    req, collection: 'animals', draft, depth: 0, overrideAccess: false, pagination: false,
    select: { name: true, slug: true, status: true, _status: true, summary: true, description: true, breed: true },
    where: { or: [{ slug: { equals: key } }, { name: { like: reference } }],
      ...(draft ? {} : featuredAnimalEligibility) },
  })
  const matches = docs.filter(doc => doc.slug === key || doc.name?.trim().toLowerCase() === key)
  if (matches.length > 1) throw new DraftRequestError(`“${reference}” matches more than one animal. Use the CMS slug.`)
  if (!matches[0]) {
    const scope = draft ? 'an animal' : 'a published, available animal'
    throw new DraftRequestError(`I couldn’t find ${scope} named “${reference}”. Check the name or CMS slug.`)
  }
  return matches[0]
}

export async function saveCatministratorDraft(payload: Payload, editor: User, input: DraftRequest) {
  if (!isEditor(editor)) throw new DraftRequestError('This CMS account cannot edit website content.')
  const request = input.action === 'animal'
    ? animalDraftRequest(input.animal, input.patch)
    : featuredDraftRequest(input.animals)
  const req = await createLocalReq({ user: { ...editor, collection: 'users' } }, payload)
  const started = await initTransaction(req)
  try {
    const options = { req, depth: 0, overrideAccess: false, draft: true } as const
    let result: { message: string; path: string }
    if (request.action === 'animal') {
      const animal = await findAnimal(req, request.animal, true)
      const fields = Object.keys(request.patch) as (keyof typeof request.patch)[]
      const changed = fields.filter(field => (animal[field] || '') !== request.patch[field])
      const patch = Object.fromEntries(changed.map(field => [field, request.patch[field]]))
      if (changed.length) {
        await payload.update({
          ...options, collection: 'animals', id: animal.id, overrideLock: false,
          data: { ...patch, _status: 'draft' },
        })
      }
      result = {
        message: changed.length
          ? `Draft saved for ${animal.name}. Updated ${changed.map(field => field === 'status' ? 'adoption status' : field).join(', ')}.`
          : `${animal.name} already has those values.`,
        path: '/admin/collections/animals/' + animal.id,
      }
    } else {
      const animals = []
      for (const name of request.animals) animals.push(await findAnimal(req, name, false))
      const ids = animals.map(animal => animal.id)
      if (new Set(ids).size !== ids.length) throw new DraftRequestError('Each featured animal can appear once.')
      const homepage = await payload.findGlobal({ ...options, slug: 'homepage' })
      const existing = featuredAnimalIds(homepage.featuredAnimals)
      const changed = homepage.featuredAnimals?.length !== ids.length || ids.some((id, index) => existing[index] !== id)
      if (changed) {
        await payload.updateGlobal({
          ...options, slug: 'homepage', overrideLock: false,
          data: { featuredAnimals: ids.map(animal => ({ animal })), _status: 'draft' },
        })
      }
      result = {
        message: (changed ? 'Featured animals draft saved.' : 'The featured list already has that order.') + '\n' +
          animals.map((animal, index) => `${index + 1}. ${animal.name}${index === 0 ? ' (lead photo)' : ''}`).join('\n'),
        path: '/admin/globals/homepage',
      }
    }
    if (started) await commitTransaction(req)
    return result
  } catch (error) {
    if (started) await killTransaction(req)
    throw error
  }
}
