import { createHmac, timingSafeEqual } from 'node:crypto'
import { commitTransaction, createLocalReq, initTransaction, killTransaction, ValidationError, type Payload, type PayloadRequest } from 'payload'
import type { Animal, User } from '../../payload-types'
import { animalProfileDTO } from '../public-content'
import type { DraftReceipt } from './drafts'
import { isEditor } from './editors'
import { DraftRequestError } from './requests'

const animalToken = /^(a\.([a-z0-9]{1,11})\.([a-z0-9]{1,8}))\.([\w-]{22})$/
const reviewLifetimeSeconds = 30 * 60

async function latestAnimalVersion(payload: Payload, id: number, depth: number, req?: PayloadRequest) {
  const { docs } = await payload.findVersions({
    collection: 'animals', req, overrideAccess: !req, depth, limit: 1,
    where: { parent: { equals: id } }, sort: ['-updatedAt', '-id'],
  })
  return docs[0]
}

type Version = Awaited<ReturnType<typeof latestAnimalVersion>>

function missingFields(animal: Version['version']) {
  return [
    !animal.name?.trim() && 'name',
    !animal.species && 'pet type',
    !animal.ageGroup && 'age group',
    !animal.description?.trim() && 'description',
    !animal.photos?.some(row => row.photo) && 'at least one photo',
  ].filter((label): label is string => typeof label === 'string')
}

function signature(secret: string, value: string, version: Version, purpose: 'preview' | 'publish', editor?: User) {
  return createHmac('sha256', secret)
    .update(JSON.stringify(['catministrator-animal-v1', purpose, value, version.id, version.updatedAt,
      editor?.id, editor?.telegramUserId, editor?.telegramLinkedAt]))
    .digest().subarray(0, 16).toString('base64url')
}

function parseAnimalToken(token: string) {
  const match = animalToken.exec(token)
  if (!match) return
  const [, value, encodedId, expiry, tag] = match
  const id = Number.parseInt(encodedId, 36)
  if (!Number.isSafeInteger(id) || id < 1 || Number.parseInt(expiry, 36) <= Math.floor(Date.now() / 1000)) return
  return { value, id, tag }
}

export async function animalReviewForDraft(req: PayloadRequest, id: number, editor: User): Promise<DraftReceipt['review']> {
  const latest = await latestAnimalVersion(req.payload, id, 0, req)
  if (!latest || latest.version._status !== 'draft') return
  const expires = Math.floor(Date.now() / 1000) + reviewLifetimeSeconds
  const value = 'a.' + id.toString(36) + '.' + expires.toString(36)
  const secret = req.payload.secret
  const missing = missingFields(latest.version)
  return {
    kind: 'animal', animal: latest.version.name,
    previewToken: value + '.' + signature(secret, value, latest, 'preview'),
    publishToken: missing.length ? undefined : value + '.' + signature(secret, value, latest, 'publish', editor),
    missing,
  }
}

export async function previewAnimalDraft(payload: Payload, token: string) {
  const parsed = parseAnimalToken(token)
  if (!parsed) return
  const latest = await latestAnimalVersion(payload, parsed.id, 2)
  if (!latest || latest.version._status !== 'draft') return
  const expected = signature(payload.secret, parsed.value, latest, 'preview')
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(parsed.tag))) return
  return animalProfileDTO({ ...latest.version, id: parsed.id })
}

export async function publishAnimalDraft(payload: Payload, editor: User, token: string): Promise<DraftReceipt> {
  if (!isEditor(editor)) throw new DraftRequestError('This CMS account cannot publish animals.')
  const parsed = parseAnimalToken(token)
  if (!parsed) throw new DraftRequestError('This approval expired. Ask me for a new animal preview.')
  const req = await createLocalReq({ user: { ...editor, collection: 'users' } }, payload)
  const started = await initTransaction(req)
  try {
    const latest = await latestAnimalVersion(payload, parsed.id, 0, req)
    if (!latest || latest.version._status !== 'draft') throw new DraftRequestError('That animal draft is no longer pending.')
    const expected = signature(payload.secret, parsed.value, latest, 'publish', editor)
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(parsed.tag))) {
      throw new DraftRequestError('The draft or editor link has changed. Ask me for a new preview and review it before publishing.')
    }
    const missing = missingFields(latest.version)
    if (missing.length) throw new DraftRequestError('Add the missing profile details before publishing: ' + missing.join(', ') + '.')
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...version } = latest.version
    const animal: Animal = await payload.update({
      req, collection: 'animals', id: parsed.id, overrideAccess: false, overrideLock: false, depth: 0, draft: false,
      data: { ...version, _status: 'published' },
    })
    if (started) await commitTransaction(req)
    return { message: `${animal.name}’s profile is published.`, path: '/animals/' + animal.slug }
  } catch (error) {
    if (started) await killTransaction(req)
    if (error instanceof ValidationError) {
      const fields = error.data.errors.map(field => field.label || field.path).filter(Boolean)
      throw new DraftRequestError('Some profile details need attention before publishing. Check ' + fields.join(', ') + ' in the CMS.')
    }
    throw error
  }
}
