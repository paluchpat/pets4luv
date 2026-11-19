import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest, type Where } from 'payload'
import type { Animal, User } from '../../payload-types'
import { featuredAnimalEligibility, featuredAnimalIds } from '../featured-animals'
import { isEditor } from './editors'
import {
  featuredAnimalsByID, featuredReviewTokens, featuredUndoToken, featuredVersionKey, isFeaturedOnlyChange,
  latestFeaturedVersion, matchesFeaturedUndo, recentFeaturedPublications, verifiedFeaturedVersion,
} from './featured-review'
import { DraftRequestError, validateDraftRequest, type DraftRequest } from './requests'

export type DraftReceipt = {
  message: string
  path: string
  review?: ReturnType<typeof featuredReviewTokens>
  changed?: boolean
  undoToken?: string
}

async function findNamedAnimals(req: PayloadRequest, reference: string, draft: boolean, filter?: Where) {
  const key = reference.toLowerCase()
  const { docs } = await req.payload.find({
    req, collection: 'animals', draft, depth: 0, overrideAccess: false, pagination: false,
    select: { name: true, slug: true, status: true, _status: true, summary: true, description: true, breed: true },
    where: { or: [{ slug: { equals: key } }, { name: { like: reference } }],
      ...filter },
  })
  return docs.filter(doc => doc.slug === key || doc.name?.trim().toLowerCase() === key)
}

async function findAnimal(req: PayloadRequest, reference: string, draft: boolean) {
  const matches = await findNamedAnimals(req, reference, draft, draft ? undefined : featuredAnimalEligibility)
  if (matches.length > 1) throw new DraftRequestError(`“${reference}” matches more than one animal. Use the CMS slug.`)
  if (!matches[0]) {
    const scope = draft ? 'an animal' : 'a published, available animal'
    throw new DraftRequestError(`I couldn’t find ${scope} named “${reference}”. Check the name or CMS slug.`)
  }
  return matches[0]
}

function oneCharacterOff(first: string, second: string) {
  if (first === second || Math.abs(first.length - second.length) > 1) return false
  const [shorter, longer] = first.length <= second.length ? [first, second] : [second, first]
  let index = 0
  while (index < shorter.length && shorter[index] === longer[index]) index++
  if (shorter.length === longer.length) return shorter.slice(index + 1) === longer.slice(index + 1)
  return shorter.slice(index) === longer.slice(index + 1)
}

async function findFeaturedReplacement(req: PayloadRequest, reference: string) {
  let candidates: Pick<Animal, 'id' | 'name' | 'slug' | 'status' | '_status'>[] = await findNamedAnimals(req, reference, false)
  if (!candidates.length && reference.length >= 4) {
    const { docs } = await req.payload.find({
      req, collection: 'animals', draft: false, depth: 0, overrideAccess: false, pagination: false,
      select: { name: true, slug: true, status: true, _status: true },
      where: { _status: { equals: 'published' } },
    })
    const key = reference.toLowerCase()
    candidates = docs.filter(animal => oneCharacterOff(key, animal.name?.trim().toLowerCase() || ''))
  }
  if (candidates.length > 1) {
    throw new DraftRequestError(`More than one animal matches “${reference}”. Use the exact name or CMS slug.`)
  }
  const [match] = candidates
  if (!match) throw new DraftRequestError(`I couldn’t find “${reference}”. Check the name or CMS slug.`)
  if (match._status !== 'published' || match.status !== 'available') {
    throw new DraftRequestError(`${match.name} needs to be published and available to be featured.`)
  }
  return match
}

export async function saveCatministratorDraft(payload: Payload, editor: User, input: DraftRequest) {
  if (!isEditor(editor)) throw new DraftRequestError('This CMS account cannot edit website content.')
  const request = validateDraftRequest(input)
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
        changed: changed.length > 0,
      }
    } else {
      const homepage = await payload.findGlobal({ ...options, slug: 'homepage' })
      const existing = featuredAnimalIds(homepage.featuredAnimals)
      let ids: number[]
      let correction = ''
      if (request.action === 'replace-featured') {
        const matches = existing.length
          ? await findNamedAnimals(req, request.animal, false, { id: { in: existing } })
          : []
        if (!matches.length) throw new DraftRequestError(`“${request.animal}” isn’t in the featured list.`)
        if (matches.length > 1) throw new DraftRequestError(`More than one featured animal matches “${request.animal}”. Use the CMS slug.`)
        const [outgoing] = matches
        const incoming = await findFeaturedReplacement(req, request.replacement)
        ids = existing.map(id => id === outgoing.id ? incoming.id : id)
        const reference = request.replacement.toLowerCase()
        if (reference !== incoming.slug && reference !== incoming.name.trim().toLowerCase()) {
          correction = ` Matched “${request.replacement}” to ${incoming.name}.`
        }
      } else if (request.action === 'lead') {
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
        message: (changed ? 'Featured animals draft saved.' : 'The featured list already has that order.') + correction + '\n' +
          animals.map((animal, index) => `${index + 1}. ${animal.name}${index === 0 ? ' (lead photo)' : ''}`).join('\n'),
        path: '/admin/globals/homepage',
        review, changed,
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
    const [published, previous] = await recentFeaturedPublications(payload, req)
    const undoToken = published && previous && live._status === 'published' && previous.version.updatedAt === live.updatedAt
      ? featuredUndoToken(payload.secret, published, previous, editor)
      : undefined
    if (started) await commitTransaction(req)
    return { message: 'Featured animals published.', path: '/', undoToken }
  } catch (error) {
    if (started) await killTransaction(req)
    throw error
  }
}


export async function undoFeaturedPublication(payload: Payload, editor: User, token: string): Promise<DraftReceipt> {
  if (!isEditor(editor)) throw new DraftRequestError('This CMS account cannot publish website content.')
  const req = await createLocalReq({ user: { ...editor, collection: 'users' } }, payload)
  const started = await initTransaction(req)
  try {
    const options = { req, slug: 'homepage', depth: 0, overrideAccess: false } as const
    const [published, previous] = await recentFeaturedPublications(payload, req)
    const live = await payload.findGlobal({ ...options, draft: false })
    if (!published || !previous || live._status !== 'published' || live.updatedAt !== published.version.updatedAt ||
        !matchesFeaturedUndo(payload.secret, token, published, previous, editor)) {
      throw new DraftRequestError('That featured publication can’t be undone here. It has changed or was published by another editor. Review Versions in the CMS.')
    }
    const draft = await payload.findGlobal({ ...options, draft: true })
    if (draft._status === 'draft') {
      throw new DraftRequestError('There’s a newer featured draft. Review it in the CMS before undoing the publication.')
    }
    const ids = featuredAnimalIds(previous.version.featuredAnimals)
    const animals = await featuredAnimalsByID(payload, ids, req)
    await payload.updateGlobal({
      ...options, draft: false, overrideLock: false,
      data: { featuredAnimals: ids.map(animal => ({ animal })), _status: 'published' },
    })
    if (started) await commitTransaction(req)
    const order = animals.map((animal, index) => `${index + 1}. ${animal.name}${index === 0 ? ' (lead photo)' : ''}`)
    return { message: ['Restored the previous featured order.', ...order].join('\n'), path: '/' }
  } catch (error) {
    if (started) await killTransaction(req)
    throw error
  }
}
