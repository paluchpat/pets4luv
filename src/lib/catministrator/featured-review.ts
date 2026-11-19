import { createHmac, timingSafeEqual } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import type { Payload, PayloadRequest } from 'payload'
import type { Homepage, User } from '../../payload-types'
import { featuredAnimalEligibility, featuredAnimalIds } from '../featured-animals'
import { DraftRequestError } from './requests'

const reviewLifetime = 30 * 60
const tokenPattern = /^([1-9]\d{0,14})\.([1-9]\d{0,11})\.([\w-]{22})$/

export function latestFeaturedVersion(payload: Payload, req?: PayloadRequest) {
  return payload.findGlobalVersions({
    slug: 'homepage', req, overrideAccess: !req, depth: 0, limit: 1, sort: ['-updatedAt', '-id'],
  }).then(({ docs }) => docs[0])
}

type Purpose = 'preview' | 'publish'

function signature(secret: string, value: string, purpose: Purpose, editor?: User) {
  return createHmac('sha256', secret)
    .update(JSON.stringify(['catministrator-featured-v1', purpose, value, editor?.id, editor?.telegramUserId, editor?.telegramLinkedAt]))
    .digest().subarray(0, 16).toString('base64url')
}

export function featuredReviewTokens(secret: string, version: number, editor: User) {
  const value = `${version}.${Math.floor(Date.now() / 1000) + reviewLifetime}`
  return {
    previewToken: value + '.' + signature(secret, value, 'preview'),
    publishToken: value + '.' + signature(secret, value, 'publish', editor),
  }
}

export function verifiedFeaturedVersion(secret: string, token: string, purpose: Purpose, editor?: User) {
  const match = tokenPattern.exec(token)
  if (!match || (purpose === 'publish' && !editor)) return
  const [, id, expiry, supplied] = match
  if (Number(expiry) <= Math.floor(Date.now() / 1000)) return
  const expected = signature(secret, id + '.' + expiry, purpose, editor)
  if (timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return Number(id)
}

export function isFeaturedOnlyChange(live: Homepage, draft: Homepage) {
  return live.heading === draft.heading && isDeepStrictEqual(live.intro, draft.intro)
}

export async function featuredAnimalsByID(payload: Payload, ids: number[], req?: PayloadRequest) {
  if (!ids.length) return []
  const { docs } = await payload.find({
    req, collection: 'animals', overrideAccess: false, draft: false, depth: 0, pagination: false,
    select: { name: true }, where: { and: [{ id: { in: ids } }, featuredAnimalEligibility] },
  })
  const byID = new Map(docs.map(animal => [animal.id, animal]))
  return ids.map(id => {
    const animal = byID.get(id)
    if (!animal) throw new DraftRequestError('One of the selected animals is no longer published and available. Send a new featured list.')
    return animal
  })
}

export async function previewFeaturedAnimals(payload: Payload, token: string) {
  const version = verifiedFeaturedVersion(payload.secret, token, 'preview')
  if (!version) return
  const latest = await latestFeaturedVersion(payload)
  if (!latest || Number(latest.id) !== version || latest.version._status !== 'draft') return
  const ids = featuredAnimalIds(latest.version.featuredAnimals)
  if (!ids.length) return
  try {
    await featuredAnimalsByID(payload, ids)
    return ids
  } catch (error) {
    if (!(error instanceof DraftRequestError)) throw error
  }
}
