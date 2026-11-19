import type { Where } from 'payload'
import { isAnimalColor } from './animal-colors'
import { buildAnimalSearchWhere } from './animal-search'
import { defaultHomepageIntro } from './homepage-intro'

export type Assessment = 'yes' | 'no' | 'unknown' | 'conditional'
export type RichText = { root: { children: unknown[]; [key: string]: unknown }; [key: string]: unknown }
export type AnimalPhotoDTO = { url: string; alt: string }
export type AnimalProfileDTO = AnimalDTO & { photos: AnimalPhotoDTO[]; weight: number | null }
export type AnimalDTO = {
  id: number | string; name: string; slug: string; species: 'cat' | 'dog'; sex: 'female' | 'male' | 'unknown';
  ageGroup: 'baby' | 'young' | 'adult' | 'senior'; size: 'small' | 'medium' | 'large' | null; breed: string;
  ageLabel: string; summary: string; description: string; careNeeds: string; status: 'available' | 'on-hold' | 'adopted';
  photo: { url: string; alt: string } | null;
  compatibility: { dogs: Assessment; cats: Assessment; children: Assessment }; compatibilityNotes: string;
}
export type HomepageIntroDTO = { heading: string; body: RichText; bodyText: string }
export type HomepageDTO = { foundationIntro: HomepageIntroDTO; heading: string; intro: RichText | null; introText: string; featuredAnimals: AnimalDTO[] }
export type AnimalFilters = { q?: string; species?: string; ageGroup?: string; size?: string; sex?: string; color?: string; goodWithDogs?: string | boolean; goodWithCats?: string | boolean; goodWithChildren?: string | boolean; page?: string | number }

// Deliberately reconstruct DTOs. Never return raw CMS documents to visitor routes or future AI tools.
export function animalDTO(doc: any, photoVariant: 'card' | 'uncropped' = 'card'): AnimalDTO {
  const photo = doc.photos?.[0]?.photo
  return {
    id: doc.id, name: doc.name, slug: doc.slug, species: doc.species, sex: doc.sex,
    ageGroup: doc.ageGroup, size: doc.size ?? null, breed: doc.breed || '', ageLabel: ageLabel(doc),
    summary: doc.summary?.trim() || '', description: doc.description || '', careNeeds: doc.careNeeds || '', status: doc.status,
    photo: photo && typeof photo === 'object' && photo.url
      ? { url: photoVariant === 'card' ? photo.sizes?.card?.url || photo.url : photo.url, alt: photo.alt || doc.name }
      : null,
    compatibility: { dogs: doc.compatibility?.dogs || 'unknown', cats: doc.compatibility?.cats || 'unknown', children: doc.compatibility?.children || 'unknown' },
    compatibilityNotes: doc.compatibilityNotes || '',
  }
}

/** Only approved public photo URLs and alt text reach the profile gallery. */
export function animalProfileDTO(doc: any): AnimalProfileDTO {
  const photos: AnimalPhotoDTO[] = (doc.photos || []).flatMap((row: any) => {
    const photo = row.photo
    return photo && typeof photo === 'object' && photo.url
      ? [{ url: photo.url, alt: photo.alt || doc.name }]
      : []
  })
  const weight = typeof doc.weight === 'number' && Number.isFinite(doc.weight) && doc.weight >= 0 ? doc.weight : null
  return { ...animalDTO(doc, 'uncropped'), photos, weight }
}

function ageLabel(doc: any) {
  if (doc.estimatedBirthDate) {
    const months = Math.max(0, Math.floor((Date.now() - new Date(doc.estimatedBirthDate).getTime()) / (365.25 / 12 * 86400000)))
    if (Number.isFinite(months)) {
      const amount = months < 12 ? Math.max(1, months) : Math.floor(months / 12)
      const unit = months < 12 ? 'month' : 'year'
      return `About ${amount} ${unit}${amount === 1 ? '' : 's'} old`
    }
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
  if (filters.q) {
    const search = buildAnimalSearchWhere(filters.q, 'public')
    if (Object.keys(search).length) and.push(search)
  }
  return { and }
}

/** Drafts are only eligible after the server has authenticated a staff preview. */
export function homepageIntroDTO(doc: { heading?: string | null; body?: RichText | null; _status?: string | null } | null | undefined, staffPreview = false): HomepageIntroDTO {
  const intro = doc && (staffPreview || doc._status === 'published') ? doc : defaultHomepageIntro
  const body = intro.body || defaultHomepageIntro.body
  return { heading: intro.heading || defaultHomepageIntro.heading, body, bodyText: richTextToText(body) }
}
