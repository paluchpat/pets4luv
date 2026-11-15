import type { Where } from 'payload'
import { isAnimalColor } from './animal-colors'

export type Assessment = 'yes' | 'no' | 'unknown' | 'conditional'
export type RichText = { root: { children: unknown[]; [key: string]: unknown }; [key: string]: unknown }
export type AnimalDTO = {
  id: number | string; name: string; slug: string; species: 'cat' | 'dog'; sex: 'female' | 'male' | 'unknown';
  ageGroup: 'baby' | 'young' | 'adult' | 'senior'; size: 'small' | 'medium' | 'large'; breed: string;
  ageLabel: string; summary: string; description: string; careNeeds: string; status: 'available' | 'on-hold' | 'adopted';
  photo: { url: string; alt: string } | null;
  compatibility: { dogs: Assessment; cats: Assessment; children: Assessment }; compatibilityNotes: string;
}
export type HomepageDTO = { heading: string; intro: RichText | null; introText: string; featuredAnimals: AnimalDTO[] }
export type AnimalFilters = { q?: string; species?: string; ageGroup?: string; size?: string; sex?: string; color?: string; goodWithDogs?: string | boolean; goodWithCats?: string | boolean; goodWithChildren?: string | boolean; page?: string | number }

// Deliberately reconstruct DTOs. Never return raw CMS documents to visitor routes or future AI tools.
export function animalDTO(doc: any): AnimalDTO {
  const photo = doc.photos?.[0]?.photo
  return {
    id: doc.id, name: doc.name, slug: doc.slug, species: doc.species, sex: doc.sex,
    ageGroup: doc.ageGroup, size: doc.size, breed: doc.breed || '', ageLabel: ageLabel(doc),
    summary: doc.summary || '', description: doc.description || '', careNeeds: doc.careNeeds || '', status: doc.status,
    photo: photo && typeof photo === 'object' && photo.url ? { url: photo.sizes?.card?.url || photo.url, alt: photo.alt || doc.name } : null,
    compatibility: { dogs: doc.compatibility?.dogs || 'unknown', cats: doc.compatibility?.cats || 'unknown', children: doc.compatibility?.children || 'unknown' },
    compatibilityNotes: doc.compatibilityNotes || '',
  }
}

function ageLabel(doc: any) {
  if (doc.estimatedBirthDate) {
    const months = Math.max(0, Math.floor((Date.now() - new Date(doc.estimatedBirthDate).getTime()) / (365.25 / 12 * 86400000)))
    if (Number.isFinite(months)) return months < 12 ? `About ${Math.max(1, months)} ${months === 1 ? 'month' : 'months'}` : `About ${Math.floor(months / 12)} ${months < 24 ? 'year' : 'years'}`
  }
  return ({ baby: 'Baby', young: 'Young', adult: 'Adult', senior: 'Senior' } as Record<string, string>)[doc.ageGroup] || 'Age unknown'
}

export function richTextToText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const node = value as any
  if (typeof node.text === 'string') return node.text
  if (node.root) return richTextToText(node.root)
  return Array.isArray(node.children) ? node.children.map(richTextToText).join(node.type === 'root' ? '\n\n' : '') : ''
}

export function buildAnimalWhere(filters: AnimalFilters = {}): Where {
  const and: Where[] = [{ _status: { equals: 'published' } }, { status: { equals: 'available' } }]
  const allowed = { species: ['cat', 'dog'], ageGroup: ['baby', 'young', 'adult', 'senior'], size: ['small', 'medium', 'large'], sex: ['female', 'male', 'unknown'] }
  for (const key of Object.keys(allowed) as (keyof typeof allowed)[]) {
    const value = filters[key]
    if (value && allowed[key].includes(value)) and.push({ [key]: { equals: value } })
  }
  if (isAnimalColor(filters.color)) and.push({ colors: { contains: filters.color } })
  for (const [filter, field] of [['goodWithDogs', 'dogs'], ['goodWithCats', 'cats'], ['goodWithChildren', 'children']] as const) {
    if ([true, 'true', 'yes', '1'].includes(filters[filter] as any)) and.push({ [`compatibility.${field}`]: { equals: 'yes' } })
  }
  const q = filters.q?.trim().slice(0, 100)
  if (q) and.push({ or: [{ name: { like: q } }, { breed: { like: q } }, { summary: { like: q } }] })
  return { and }
}
