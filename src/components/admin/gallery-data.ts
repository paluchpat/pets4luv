import type { Payload, Sort, TypedUser, Where } from 'payload'
import { mergeListSearchAndWhere } from 'payload/shared'
import { featuredAnimalEligibility, featuredAnimalIds } from '../../lib/featured-animals'
import { adminAnimalCard, type AdminAnimalCard } from '../../lib/admin-animal-gallery'
import { defaultAdminAnimalSort } from '../../lib/admin-animal-sorts'

function isStaff(user: TypedUser | null | undefined): user is TypedUser {
  return Boolean(user && ['admin', 'editor'].includes(String(user.role)))
}

/** Use the live Featured animals order; draft or unavailable selections are not featured. */
async function featuredAnimalIDs(payload: Payload, user: TypedUser): Promise<number[]> {
  const homepage = await payload.findGlobal({ slug: 'homepage', overrideAccess: false, user, draft: false, depth: 0, select: { featuredAnimals: true, _status: true } })
  if (homepage._status !== 'published') return []
  const selected = featuredAnimalIds(homepage.featuredAnimals)
  if (!selected.length) return []
  const available = await payload.find({ collection: 'animals', overrideAccess: false, user, draft: false, depth: 0, pagination: false,
    where: { and: [{ id: { in: selected } }, featuredAnimalEligibility] }, select: {},
  })
  const availableIDs = new Set(available.docs.map(doc => doc.id))
  return selected.filter(id => availableIDs.has(id))
}

async function cardsForIDs(payload: Payload, user: TypedUser, ids: number[], featured: number[]): Promise<AdminAnimalCard[]> {
  if (!ids.length) return []
  const [animals, published] = await Promise.all([
    payload.find({ collection: 'animals', overrideAccess: false, user, draft: true, depth: 1,
      where: { id: { in: ids } }, pagination: false,
      select: { name: true, species: true, sex: true, status: true, ageGroup: true, estimatedBirthDate: true, photos: true, updatedAt: true, _status: true },
    }),
    payload.find({ collection: 'animals', overrideAccess: false, user, draft: false, depth: 0, pagination: false,
      where: { and: [{ id: { in: ids } }, { _status: { equals: 'published' } }] }, select: { _status: true },
    }),
  ])
  const publishedIDs = new Set(published.docs.map(doc => String(doc.id)))
  const featuredIDs = new Set(featured.map(String))
  const byID = new Map(animals.docs.map(doc => [doc.id, adminAnimalCard(doc, publishedIDs, featuredIDs)]))
  return ids.flatMap(id => { const card = byID.get(id); return card ? [card] : [] })
}

type AdminGalleryQuery = { where?: Where; search?: string; sort?: Sort; page: number; limit: number }

/** Rank all matching IDs before pagination; only load photo/profile data for the visible page. */
export async function loadAdminGalleryPageCards(payload: Payload, user: TypedUser | null | undefined, query: AdminGalleryQuery): Promise<AdminAnimalCard[]> {
  if (!isStaff(user)) return []
  const sort = query.sort ?? defaultAdminAnimalSort
  const featureFirst = sort.toString() === defaultAdminAnimalSort
  const [featured, matching] = await Promise.all([
    featuredAnimalIDs(payload, user),
    payload.find({ collection: 'animals', overrideAccess: false, user, draft: true, depth: 0, pagination: false, select: {},
      where: mergeListSearchAndWhere({ collectionConfig: payload.collections.animals.config, search: query.search || '', where: query.where }),
      sort: featureFirst ? ['-createdAt', '-id'] : sort,
    }),
  ])
  const ordered = matching.docs.map(doc => doc.id)
  if (featureFirst) {
    const ranks = new Map(featured.map((id, index) => [id, index]))
    ordered.sort((a, b) => (ranks.get(a) ?? featured.length) - (ranks.get(b) ?? featured.length))
  }
  const offset = (Math.max(1, query.page) - 1) * query.limit
  return cardsForIDs(payload, user, ordered.slice(offset, offset + query.limit), featured)
}

/** Only authenticated staff can obtain unpublished cards. Dashboard cards always feature first. */
export async function loadAdminGalleryCards(payload: Payload, user: TypedUser | null | undefined, ids?: number[]): Promise<AdminAnimalCard[]> {
  if (!isStaff(user) || ids?.length === 0) return []
  if (!ids) return loadAdminGalleryPageCards(payload, user, { page: 1, limit: 5 })
  return cardsForIDs(payload, user, ids, await featuredAnimalIDs(payload, user))
}
