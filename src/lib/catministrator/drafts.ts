import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'
import type { User } from '../../payload-types'
import { featuredAnimalEligibility, featuredAnimalIds } from '../featured-animals'
import { isEditor } from './editors'
import { featuredAnimalsByID, featuredReviewTokens, featuredVersionKey, isFeaturedOnlyChange, latestFeaturedVersion, verifiedFeaturedVersion } from './featured-review'
import { animalDraftRequest, DraftRequestError, featuredDraftRequest, leadDraftRequest, type DraftRequest } from './requests'

export type DraftReceipt = {
  message: string
  path: string
  review?: ReturnType<typeof featuredReviewTokens>
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
    : input.action === 'lead' ? leadDraftRequest(input.animal) : featuredDraftRequest(input.animals)
  const req = await createLocalReq({ user: { ...editor, collection: 'users' } }, payload)
  const started = await initTransaction(req)
  try {
    const options = { req, depth: 0, overrideAccess: false, draft: true } as const
    let result: DraftReceipt
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
      const homepage = await payload.findGlobal({ ...options, slug: 'homepage' })
      const existing = featuredAnimalIds(homepage.featuredAnimals)
      let ids: number[]
      if (request.action === 'lead') {
        const lead = await findAnimal(req, request.animal, false)
        ids = [lead.id, ...(existing.includes(lead.id) ? existing.filter(id => id !== lead.id) : existing.slice(1))]
      } else {
        ids = []
        for (const name of request.animals) ids.push((await findAnimal(req, name, false)).id)
      }
      if (new Set(ids).size !== ids.length) throw new DraftRequestError('Each featured animal can appear once.')
      const animals = await featuredAnimalsByID(payload, ids, req)
      const changed = homepage.featuredAnimals?.length !== ids.length || ids.some((id, index) => existing[index] !== id)
      if (changed) {
        await payload.updateGlobal({
          ...options, slug: 'homepage', overrideLock: false,
          data: { featuredAnimals: ids.map(animal => ({ animal })), _status: 'draft' },
        })
      }
      const latest = await latestFeaturedVersion(payload, req)
      const live = await payload.findGlobal({ ...options, slug: 'homepage', draft: false })
      const review = latest?.version._status === 'draft' && isFeaturedOnlyChange(live, latest.version)
        ? featuredReviewTokens(payload.secret, latest, editor)
        : undefined
      result = {
        message: (changed ? 'Featured animals draft saved.' : 'The featured list already has that order.') + '\n' +
          animals.map((animal, index) => `${index + 1}. ${animal.name}${index === 0 ? ' (lead photo)' : ''}`).join('\n'),
        path: '/admin/globals/homepage',
        review,
      }
    }
    if (started) await commitTransaction(req)
    return result
  } catch (error) {
    if (started) await killTransaction(req)
    throw error
  }
}

export async function publishFeaturedDraft(payload: Payload, editor: User, token: string): Promise<DraftReceipt> {
  if (!isEditor(editor)) throw new DraftRequestError('This CMS account cannot publish website content.')
  const version = verifiedFeaturedVersion(payload.secret, token, 'publish', editor)
  if (!version) throw new DraftRequestError('This approval has expired or belongs to another editor. Request a new preview.')
  const req = await createLocalReq({ user: { ...editor, collection: 'users' } }, payload)
  const started = await initTransaction(req)
  try {
    const options = { req, slug: 'homepage', depth: 0, overrideAccess: false } as const
    const latest = await latestFeaturedVersion(payload, req)
    if (!latest || latest.version._status !== 'draft') {
      throw new DraftRequestError('That draft is no longer pending. Check the homepage or send a new featured request.')
    }
    const live = await payload.findGlobal({ ...options, draft: false })
    if (!isFeaturedOnlyChange(live, latest.version)) {
      throw new DraftRequestError('Other homepage edits are pending. Review and publish them in the CMS.')
    }
    const ids = featuredAnimalIds(latest.version.featuredAnimals)
    if (!ids.length) throw new DraftRequestError('This draft has no featured animals. Send a new featured list.')
    await featuredAnimalsByID(payload, ids, req)
    if (featuredVersionKey(latest) !== version) {
      if (started) await commitTransaction(req)
      return {
        message: 'The draft changed. Review this new preview before publishing.',
        path: '/admin/globals/homepage',
        review: featuredReviewTokens(payload.secret, latest, editor),
      }
    }
    await payload.updateGlobal({
      ...options, draft: false, overrideLock: false,
      data: { featuredAnimals: ids.map(animal => ({ animal })), _status: 'published' },
    })
    if (started) await commitTransaction(req)
    return { message: 'Featured animals published.', path: '/' }
  } catch (error) {
    if (started) await killTransaction(req)
    throw error
  }
}
