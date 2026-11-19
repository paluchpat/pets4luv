import { featuredAnimalLimit } from '../featured-animals'

export class DraftRequestError extends Error {}

export class DeleteRequestError extends DraftRequestError {}

const statuses = ['available', 'on-hold', 'adopted'] as const
const textFields = { summary: 220, description: 3000, breed: 150 }
type Status = (typeof statuses)[number]
export type AnimalPatch = { summary?: string; description?: string; breed?: string; status?: Status }
export type DraftRequest =
  | { action: 'animal'; animal: string; patch: AnimalPatch }
  | { action: 'featured'; animals: string[] }
  | { action: 'lead'; animal: string }
  | { action: 'replace-featured'; animal: string; replacement: string }

export const commandHelp = [
  'Draft an animal edit:',
  '/edit Fig | summary=Sweet and playful.',
  '/edit Tiny | status=pending',
  '',
  'Draft a featured list in homepage order:',
  '/featured Fig, Frida, Rollo',
  '/lead Tiny — change the lead animal',
  '/replace Tiny | Mochachina — replace one featured animal',
].join('\n')

function animalReference(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 160) {
    throw new DraftRequestError('Enter the animal’s exact name or CMS slug.')
  }
  return value.trim()
}

export function animalDraftRequest(animal: unknown, patch: Record<string, unknown>): DraftRequest {
  const reference = animalReference(animal)
  const changes: AnimalPatch = {}
  for (const [field, raw] of Object.entries(patch)) {
    if (typeof raw !== 'string') throw new DraftRequestError('Enter a text value for ' + field + '.')
    const value = raw.trim()
    if (field === 'status') {
      const status = value.toLowerCase() === 'pending' ? 'on-hold' : value.toLowerCase()
      if (!statuses.some(option => option === status)) {
        throw new DraftRequestError('Use available, pending, or adopted for the adoption status.')
      }
      changes.status = status as Status
    } else if (field === 'summary' || field === 'description' || field === 'breed') {
      if (!value || value.length > textFields[field]) {
        throw new DraftRequestError(`The ${field} needs 1–${textFields[field]} characters.`)
      }
      changes[field] = value
    } else {
      throw new DraftRequestError('I can draft changes to the summary, description, reported breed, or adoption status.')
    }
  }
  if (!Object.keys(changes).length) throw new DraftRequestError('Tell me which field to change and what to put in it.')
  return { action: 'animal', animal: reference, patch: changes }
}

export function featuredDraftRequest(animals: unknown): DraftRequest {
  if (!Array.isArray(animals) || !animals.length || animals.length > featuredAnimalLimit) {
    throw new DraftRequestError(`Give me 1–${featuredAnimalLimit} animals in homepage order.`)
  }
  const names = animals.map(animalReference)
  if (new Set(names.map(name => name.toLowerCase())).size !== names.length) {
    throw new DraftRequestError('Each featured animal can appear once.')
  }
  return { action: 'featured', animals: names }
}

export function leadDraftRequest(animal: unknown): DraftRequest {
  return { action: 'lead', animal: animalReference(animal) }
}

export function featuredReplacementRequest(animal: unknown, replacement: unknown): DraftRequest {
  return { action: 'replace-featured', animal: animalReference(animal), replacement: animalReference(replacement) }
}

export function validateDraftRequest(draft: unknown): DraftRequest {
  if (!draft || typeof draft !== 'object') throw new DraftRequestError('Send one draft request.')
  const value = draft as Record<string, unknown>
  if (value.action === 'lead') return leadDraftRequest(value.animal)
  if (value.action === 'featured') return featuredDraftRequest(value.animals)
  if (value.action === 'replace-featured') return featuredReplacementRequest(value.animal, value.replacement)
  if (value.action === 'animal' && value.patch && typeof value.patch === 'object' && !Array.isArray(value.patch)) {
    return animalDraftRequest(value.animal, value.patch as Record<string, unknown>)
  }
  throw new DraftRequestError('Send one supported draft request.')
}

export function parseDraftCommand(message: string): DraftRequest | undefined {
  const command = /^\/(edit|featured|lead|replace)(?:\s+([\s\S]+))?$/i.exec(message.trim())
  if (!command) return undefined
  const text = command[2] || ''
  if (command[1].toLowerCase() === 'featured') return featuredDraftRequest(text.split(','))
  if (command[1].toLowerCase() === 'lead') return leadDraftRequest(text)
  if (command[1].toLowerCase() === 'replace') {
    const parts = text.split('|')
    if (parts.length !== 2) throw new DraftRequestError('Use /replace followed by the current animal, a |, and the replacement.')
    return featuredReplacementRequest(parts[0], parts[1])
  }
  const [animal, ...fields] = text.split('|')
  const pairs = new Map<string, string>()
  for (const field of fields) {
    const equals = field.indexOf('=')
    if (equals < 0) throw new DraftRequestError('Use field=value for each edit.')
    const name = field.slice(0, equals).trim().toLowerCase()
    if (pairs.has(name)) throw new DraftRequestError('Include each field once.')
    pairs.set(name, field.slice(equals + 1))
  }
  return animalDraftRequest(animal, Object.fromEntries(pairs))
}
