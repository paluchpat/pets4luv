import type { Animal } from '../payload-types'
import { animalDTO } from './public-content'

export type AdminAnimalCard = {
  id: Animal['id']
  name: string
  age: string
  gender: string
  species: 'cat' | 'dog' | null
  status: 'available' | 'on-hold' | 'adopted' | null
  publication: 'published' | 'draft' | 'changed'
  photos: number
  photo: { url: string; alt: string } | null
  featured: boolean
  updated: string
}

/** Staff-only projection: gallery cards never need internal notes, source IDs, or media metadata. */
export function adminAnimalCard(doc: Pick<Animal, 'id' | 'name' | 'species' | 'sex' | 'ageGroup' | 'estimatedBirthDate' | 'status' | 'photos' | 'updatedAt' | '_status'>, publishedIDs: ReadonlySet<string>, featuredIDs: ReadonlySet<string>): AdminAnimalCard {
  const animal = animalDTO(doc, 'uncropped')
  const updated = doc.updatedAt ? new Date(doc.updatedAt) : null
  return {
    id: doc.id, name: doc.name?.trim() || 'Untitled animal', age: animal.ageLabel,
    gender: doc.sex === 'female' ? 'Female' : doc.sex === 'male' ? 'Male' : 'Gender not listed',
    species: doc.species === 'cat' || doc.species === 'dog' ? doc.species : null, status: ['available', 'on-hold', 'adopted'].includes(doc.status) ? doc.status : null,
    publication: doc._status === 'published' ? 'published' : publishedIDs.has(String(doc.id)) ? 'changed' : 'draft',
    photos: doc.photos?.length || 0,
    photo: animal.photo,
    featured: featuredIDs.has(String(doc.id)) && publishedIDs.has(String(doc.id)),
    updated: updated && Number.isFinite(updated.getTime()) ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }).format(updated) : '',
  }
}
