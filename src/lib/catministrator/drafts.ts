import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest, type Where } from 'payload'
import type { Animal, User } from '../../payload-types'
import { featuredAnimalEligibility, featuredAnimalIds } from '../featured-animals'
import { animalReviewForDraft, publishAnimalDraft } from './animal-review'
import { savePageTextDraft } from './page-drafts'
import { isEditor } from './editors'
import {
  featuredAnimalsByID, featuredReviewTokens, featuredUndoToken, featuredVersionKey, isFeaturedOnlyChange,
  latestFeaturedVersion, matchesFeaturedUndo, recentFeaturedPublications, verifiedFeaturedVersion,
} from './featured-review'
import { AnimalNameError, DraftRequestError, validateDraftRequest, type AnimalNameIssue, type DraftRequest } from './requests'

export type DraftReceipt = {
  message: string
  path: string
  review?: ReturnType<typeof featuredReviewTokens> & { kind?: never }
    | { kind: 'animal'; animal: string; previewToken: string; publishToken?: string; missing: string[] }
  changed?: boolean
  undoToken?: string
}

async function findNamedAnimals(req: PayloadRequest, reference: string, draft: boolean, filter?: Where) {
  const key = reference.toLowerCase()
  const explicitSlug = key.startsWith('slug:')
  const named: Where = explicitSlug
    ? { slug: { equals: key.slice(5) } }
    : { or: [{ slug: { equals: key } }, { name: { like: reference } }] }
  const { docs } = await req.payload.find({
    req, collection: 'animals', draft, depth: 0, overrideAccess: false, pagination: false,
    select: { name: true, slug: true, status: true, _status: true, summary: true, description: true, breed: true },
    where: { ...named, ...filter },
  })
  if (explicitSlug) return docs
  return docs.filter(doc => doc.slug === key || doc.name?.trim().toLowerCase() === key)
}

export async function findAnimal(req: PayloadRequest, reference: string, draft: boolean, field: AnimalNameIssue['field'] = 'animal') {
  const matches = await findNamedAnimals(req, reference, draft, draft ? undefined : featuredAnimalEligibility)
  if (matches.length > 1) {
    throw new AnimalNameError(`“${reference}” matches more than one animal.`, { field, reference, suggestions: nameChoices(matches) })
  }
  if (!matches[0]) {
    const scope = draft ? 'an animal' : 'a published, available animal'
    const suggestions = await suggestNames(req, reference, draft, draft ? undefined : featuredAnimalEligibility)
    throw new AnimalNameError(`I couldn’t find ${scope} named “${reference}”.`, { field, reference, suggestions })
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

function nameChoices(animals: Pick<Animal, 'name' | 'slug'>[]) {
  return animals.filter(animal => animal.name && animal.slug).slice(0, 3).map(({ name, slug }) => ({ name, slug }))
}

async function suggestNames(req: PayloadRequest, reference: string, draft: boolean, where?: Where) {
  const key = reference.trim().toLowerCase()
  if (key.length < 2) return []
  const { docs } = await req.payload.find({
    req, collection: 'animals', draft, depth: 0, overrideAccess: false, pagination: false,
    select: { name: true, slug: true }, sort: ['name', 'id'], where,
  })
  const prefix = docs.filter(animal => animal.name?.trim().toLowerCase().startsWith(key) || animal.slug?.startsWith(key))
  if (prefix.length) return nameChoices(prefix)
  return key.length < 4 ? [] : nameChoices(docs.filter(animal => oneCharacterOff(key, animal.name?.trim().toLowerCase() || '')))
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
    const eligible = candidates.filter(animal => animal.status === 'available' && animal._status === 'published')
    throw new AnimalNameError(`More than one animal matches “${reference}”.`, { field: 'replacement', reference, suggestions: nameChoices(eligible) })
  }
  const [match] = candidates
  if (!match) {
    const suggestions = await suggestNames(req, reference, false, featuredAnimalEligibility)
    throw new AnimalNameError(`I couldn’t find “${reference}”.`, { field: 'replacement', reference, suggestions })
  }
  if (match._status !== 'published' || match.status !== 'available') {
    throw new DraftRequestError(`${match.name} needs to be published and available to be featured.`)
  }
  return match
}

export async function saveCatministratorDraft(
  payload: Payload, editor: User, input: DraftRequest, expectedFeaturedVersion?: string | null,
) {
  if (!isEditor(editor)) throw new DraftRequestError('This CMS account cannot edit website content.')
  const request = validateDraftRequest(input)
  const req = await createLocalReq({ user: { ...editor, collection: 'users' } }, payload)
  const started = await initTransaction(req)
  let featuredVersion: string | null | undefined
  try {
    const options = { req, depth: 0, overrideAccess: false, draft: true } as const
    let result: DraftReceipt
    if (request.action === 'page-text') {
      result = await savePageTextDraft(req, request)
    } else if (request.action === 'animal') {
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
        review: await animalReviewForDraft(req, animal.id, editor),
        changed: changed.length > 0,
      }
    } else {
      const base = await latestFeaturedVersion(payload, req)
      featuredVersion = base ? featuredVersionKey(base) : null
      if (expectedFeaturedVersion !== undefined && expectedFeaturedVersion !== featuredVersion) {
        throw new DraftRequestError('The featured list changed while I was waiting for the name. Send a new featured request to start from the current list.')
      }
      const homepage = await payload.findGlobal({ ...options, slug: 'homepage' })
      const existing = featuredAnimalIds(homepage.featuredAnimals)
      let ids: number[]
      let correction = ''
      if (request.action === 'replace-featured') {
        const matches = existing.length
          ? await findNamedAnimals(req, request.animal, false, { id: { in: existing } })
          : []
        if (!matches.length) {
          const suggestions = existing.length ? await suggestNames(req, request.animal, false, { id: { in: existing } }) : []
          throw new AnimalNameError(`“${request.animal}” isn’t in the featured list.`, { field: 'animal', reference: request.animal, suggestions })
        }
        if (matches.length > 1) {
          throw new AnimalNameError(`More than one featured animal matches “${request.animal}”.`, {
            field: 'animal', reference: request.animal, suggestions: nameChoices(matches),
          })
        }
        const [outgoing] = matches
        const incoming = await findFeaturedReplacement(req, request.replacement)
        ids = existing.map(id => id === outgoing.id ? incoming.id : id)
        const reference = request.replacement.toLowerCase()
        if (reference !== incoming.slug && reference !== 'slug:' + incoming.slug && reference !== incoming.name.trim().toLowerCase()) {
          correction = ` Matched “${request.replacement}” to ${incoming.name}.`
        }
      } else if (request.action === 'lead') {
        const lead = await findAnimal(req, request.animal, false)
        ids = [lead.id, ...(existing.includes(lead.id) ? existing.filter(id => id !== lead.id) : existing.slice(1))]
      } else {
        ids = []
        for (const [index, name] of request.animals.entries()) ids.push((await findAnimal(req, name, false, index)).id)
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
    if (error instanceof AnimalNameError) error.issue.featuredVersion = featuredVersion
    if (started) await killTransaction(req)
    throw error
  }
}

export async function reviewCatministratorAnimal(payload: Payload, editor: User, reference: string): Promise<DraftReceipt> {
  if (!isEditor(editor)) throw new DraftRequestError('This CMS account cannot review animal drafts.')
  const req = await createLocalReq({ user: { ...editor, collection: 'users' } }, payload)
  const animal = await findAnimal(req, reference, true)
  const review = await animalReviewForDraft(req, animal.id, editor)
  if (!review) throw new DraftRequestError(`${animal.name} has no pending draft to preview.`)
  return { message: `Here’s the draft for ${animal.name}.`, path: '/admin/collections/animals/' + animal.id, review }
}

export function publishCatministratorDraft(payload: Payload, editor: User, token: string) {
  return token.startsWith('a.') ? publishAnimalDraft(payload, editor, token) : publishFeaturedDraft(payload, editor, token)
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
